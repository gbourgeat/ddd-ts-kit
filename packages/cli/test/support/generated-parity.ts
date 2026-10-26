import fs from 'node:fs';
import path from 'node:path';
import { cli, tempDir } from '../helpers';
import type { DeclaredDifference } from './support-matrix';

type Flags = Readonly<Record<string, string>>;

/** A value of a flag a project may pick instead of another, generated with every capability of the kit on. */
export interface GeneratedFamily {
  readonly family: string;
  /** The flags of each member, over `EVERY_CAPABILITY`. */
  readonly members: Readonly<Record<string, Flags>>;
  /** How a member names itself in what it generates, to compare the sentences of two members. */
  readonly spellings?: Readonly<Record<string, readonly string[]>>;
}

/** Every capability a project may turn on, at once. */
const EVERY_CAPABILITY: Flags = {
  tenancy: 'shared-table',
  queue: 'database',
  audit: 'on',
  'event-sourcing': 'on',
  privacy: 'on',
  cache: 'redis',
  storage: 's3',
  broker: 'kafka',
  errors: 'sentry',
  logger: 'pino',
  authz: 'abac',
  rpc: 'orpc',
  context: 'billing:core',
};

const each = (flag: string, values: readonly string[]): Record<string, Flags> =>
  Object.fromEntries(values.map((value) => [value, { [flag]: value }]));

export const GENERATED_FAMILIES: readonly GeneratedFamily[] = [
  {
    family: 'orm',
    members: each('orm', ['knex', 'drizzle', 'prisma', 'typeorm']),
    spellings: { drizzle: ['drizzle-kit'], prisma: ['Prisma'], typeorm: ['TypeORM'], knex: ['Knex'] },
  },
  {
    family: 'container',
    members: {
      tsyringe: { di: 'tsyringe', http: 'express' },
      manual: { di: 'manual', http: 'express' },
      nest: { di: 'nest', http: 'nest' },
    },
  },
  { family: 'http', members: each('http', ['express', 'fastify', 'hono']) },
  { family: 'tests', members: each('tests', ['vitest', 'jest']) },
  { family: 'broker', members: each('broker', ['rabbitmq', 'kafka', 'nats', 'redis']) },
  { family: 'logger', members: each('logger', ['pino', 'winston']) },
  { family: 'validation', members: each('validation', ['zod', 'class-validator', 'typebox', 'standard-schema']) },
  { family: 'authn', members: each('authn', ['jwt', 'keycloak']) },
  { family: 'authz', members: each('authz', ['rbac', 'abac', 'rebac']) },
  { family: 'queue', members: each('queue', ['database', 'redis']) },
  { family: 'docs-ui', members: each('docs-ui', ['swagger', 'scalar', 'redoc']) },
  { family: 'ci', members: each('ci', ['github', 'gitlab']) },
  { family: 'package-manager', members: each('package-manager', ['npm', 'pnpm']) },
  { family: 'rpc', members: each('rpc', ['orpc', 'trpc']) },
  { family: 'storage', members: each('storage', ['local', 's3']) },
];

/** What a member gives a project: its refusal, or its platform todos and the packages of the kit it installs. */
interface Generated {
  readonly refusal?: string;
  readonly traits: readonly string[];
  /** The same, the member named `<member>`. */
  readonly anonymous: readonly string[];
}

/**
 * The differences between the members of a family that no line of `declared` explains: a member
 * that `init` refuses where its siblings are generated, a platform todo or a package of the kit
 * that some members get and others not; and the declared lines that no longer hold.
 */
export function differencesOf(family: GeneratedFamily, declared: readonly DeclaredDifference[]): string[] {
  const generated = new Map(
    Object.entries(family.members).map(([member, flags]) => [member, generate(family, member, flags)]),
  );

  const lines = declared.filter((line) => line.family === family.family);

  return [...refusals(generated), ...traitGaps(generated, lines), ...staleLines(generated, lines)];
}

function refusals(generated: Map<string, Generated>): string[] {
  return [...generated]
    .filter(([, project]) => project.refusal !== undefined)
    .map(([member, project]) => `${member} is refused with every capability on: ${project.refusal ?? ''}`);
}

/** A trait of a member that a sibling has neither as it is written nor once each names itself `<member>`. */
function traitGaps(generated: Map<string, Generated>, lines: readonly DeclaredDifference[]): string[] {
  const generatedOnes = [...generated].filter(([, project]) => project.refusal === undefined);

  const gaps = generatedOnes.flatMap(([owner, project]) =>
    project.traits.flatMap((trait, index) => {
      const named = project.anonymous[index] ?? trait;

      return generatedOnes
        .filter(([, sibling]) => !sibling.traits.includes(trait) && !sibling.anonymous.includes(named))
        .filter(([member]) => !lines.some((line) => line.trait.test(named) && line.without[member] !== undefined))
        .map(([member]) => `${member} lacks "${named}", which ${owner} gets`);
    }),
  );

  return [...new Set(gaps)];
}

function staleLines(generated: Map<string, Generated>, lines: readonly DeclaredDifference[]): string[] {
  const traits = [...generated.values()].flatMap((project) => project.anonymous);

  return lines.flatMap((line) => [
    ...(traits.some((trait) => line.trait.test(trait))
      ? []
      : [`no member gets ${String(line.trait)} any more: remove it from the declared differences`]),
    ...Object.keys(line.without)
      .filter((member) => generated.get(member)?.anonymous.some((trait) => line.trait.test(trait)) ?? true)
      .map(
        (member) =>
          `${member} now gets ${String(line.trait)}, or is no member: remove it from the declared differences`,
      ),
  ]);
}

function generate(family: GeneratedFamily, member: string, flags: Flags): Generated {
  const root = tempDir(`matrix-${family.family}-${member}`);
  const asked = { ...EVERY_CAPABILITY, ...flags };
  const result = cli(root, 'init', ...Object.entries(asked).flatMap(([flag, value]) => [`--${flag}`, value]), '--sdk');

  if (result.code !== 0) {
    return { refusal: result.stderr || result.stdout, traits: [], anonymous: [] };
  }

  const names = [member, ...(family.spellings?.[member] ?? [])];
  const traits = [...platformTodos(root), ...kitPackages(root)];

  return { traits, anonymous: traits.map((trait) => anonymous(trait, names)) };
}

/** The first sentence of each platform todo. */
function platformTodos(root: string): string[] {
  const todos = filesOf(root).flatMap((file) => [
    ...fs.readFileSync(file, 'utf8').matchAll(/TODO\(platform\):?\s*([^.\n]*)/g),
  ]);

  return [...new Set(todos.map((match) => `TODO(platform): ${(match[1] ?? '').trim()}`))];
}

function kitPackages(root: string): string[] {
  const manifest: unknown = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const sections = ['dependencies', 'devDependencies'].map((key) => Reflect.get(Object(manifest), key));
  const packages = sections.flatMap((section) => Object.keys(Object(section)));

  return packages.filter((name) => name.startsWith('@ddd-ts-kit/')).map((name) => `package ${name}`);
}

function anonymous(text: string, names: readonly string[]): string {
  return [...names]
    .sort((first, second) => second.length - first.length)
    .reduce((written, name) => written.replaceAll(new RegExp(`\\b${name}\\b`, 'gi'), '<member>'), text.trim());
}

function filesOf(root: string): string[] {
  return fs
    .readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.parentPath.includes('node_modules'))
    .map((entry) => path.join(entry.parentPath, entry.name));
}
