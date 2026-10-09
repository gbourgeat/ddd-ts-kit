import type { Config } from '../config.js';
import { readTemplate } from '../templates.js';
import { DEPCRUISE_FILE } from '../depcruise/configuration.js';
import { CliError } from '../errors.js';
import type { Workspace } from '../workspace.js';

/** Ranges written to the generated package.json; bumped together with the kit. */
const VERSIONS: Readonly<Record<string, string>> = {
  '@ddd-ts-kit/kernel': '^0.1.0',
  '@ddd-ts-kit/validation': '^0.1.0',
  '@ddd-ts-kit/http': '^0.1.0',
  '@ddd-ts-kit/tracing': '^0.1.0',
  '@ddd-ts-kit/di': '^0.1.0',
  '@ddd-ts-kit/events': '^0.1.0',
  '@ddd-ts-kit/testing': '^0.1.0',
  '@ddd-ts-kit/drizzle': '^0.1.0',
  '@ddd-ts-kit/knex': '^0.1.0',
  '@ddd-ts-kit/prisma': '^0.1.0',
  '@ddd-ts-kit/typeorm': '^0.1.0',
  'ddd-ts-kit': '^0.1.0',
  tsx: '^4.23.15',
  vitest: '^5.0.3',
  zod: '^4.6.5',
  express: '^5.3.0',
  fastify: '^5.12.5',
  tsyringe: '^4.10.0',
  'reflect-metadata': '^0.2.2',
  '@opentelemetry/api': '^1.9.1',
  '@opentelemetry/sdk-node': '^0.223.0',
  '@opentelemetry/auto-instrumentations-node': '^0.81.0',
  '@opentelemetry/exporter-trace-otlp-http': '^0.223.0',
  '@nestjs/common': '^12.1.2',
  '@nestjs/core': '^12.1.2',
  '@nestjs/platform-express': '^12.1.2',
  rxjs: '^7.8.2',
  'class-validator': '^0.15.1',
  'class-transformer': '^0.5.1',
  'class-validator-jsonschema': '^5.2.0',
  'drizzle-orm': '^0.45.4',
  'drizzle-kit': '^0.31.11',
  pg: '^8.23.1',
  '@types/pg': '^8.23.1',
  '@electric-sql/pglite': '^0.5.8',
  '@electric-sql/pglite-socket': '^0.2.11',
  knex: '^3.3.0',
  '@prisma/client': '^7.10.0',
  '@prisma/adapter-pg': '^7.10.0',
  prisma: '^7.10.0',
  typeorm: '^1.1.2',
  '@faker-js/faker': '^10.6.0',
  '@types/node': '^24.0.0',
  '@types/express': '^5.0.6',
  jest: '^30.5.2',
  '@jest/globals': '^30.5.2',
  '@swc/core': '^1.16.13',
  '@swc/jest': '^0.2.39',
};

export interface ManifestRequest {
  readonly config: Config;
  readonly projectName: string;
  readonly force: boolean;
}

/** Creates package.json, or adds what is missing to an existing one without touching what is there. */
export function writeManifest(ws: Workspace, request: ManifestRequest): void {
  const { config } = request;
  const scripts = scriptsFor(config);
  const wanted = dependenciesFor(config);
  const existing = ws.read('package.json');
  if (existing === undefined) {
    ws.create('package.json', serialize({ name: request.projectName, version: '0.1.0', private: true, type: 'module', engines: { node: '>=22.12.0' }, scripts, ...wanted }));
    return;
  }
  const manifest = parseManifest(existing);
  const merge = mergeInto(ws, manifest, request.force);
  merge('scripts', scripts, (name) => `package.json keeps its own "${name}" script; the kit expects: ${scripts[name] ?? ''}`);
  merge('dependencies', wanted.dependencies, keptRange);
  merge('devDependencies', wanted.devDependencies, keptRange);
  if (manifest['type'] === undefined) manifest['type'] = 'module';
  else if (manifest['type'] !== 'module') ws.note('package.json is not "type": "module"; the generated code is written as ES modules.');
  ws.update('package.json', serialize(manifest));
}

const serialize = (manifest: unknown): string => `${JSON.stringify(manifest, null, 2)}\n`;
const keptRange = (name: string): string => `package.json keeps its own range for ${name}; the kit was built against ${VERSIONS[name] ?? 'latest'}.`;

function parseManifest(text: string): Record<string, unknown> {
  let manifest: unknown;
  try {
    manifest = JSON.parse(text);
  } catch {
    throw new CliError('package.json is not valid JSON.', 'Fix its syntax, then run `ddd-ts-kit init` again.');
  }
  if (isRecord(manifest)) return manifest;
  throw new CliError('package.json must hold a JSON object.', 'Fix it, then run `ddd-ts-kit init` again.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type Merge = (key: string, additions: Record<string, string>, kept: (name: string) => string) => void;

function mergeInto(ws: Workspace, manifest: Record<string, unknown>, force: boolean): Merge {
  return (key, additions, kept) => {
    const current = isRecord(manifest[key]) ? manifest[key] : {};
    for (const [name, value] of Object.entries(additions)) {
      if (current[name] === undefined || force) current[name] = value;
      else if (current[name] !== value) ws.note(kept(name));
    }
    manifest[key] = current;
  };
}

const GATES = ['typecheck', 'lint', 'test', 'test:e2e', 'check:arch', 'depcruise', 'deadcode', 'docs:check'];

function scriptsFor(config: Config): Record<string, string> {
  const scripts = {
    ...pipelineManifest().scripts,
    start: `node dist/${config.sourceRoot}/main.js`,
    dev: `tsx watch --env-file-if-exists=.env --import ./${config.platformDir}/tracing.ts ${config.sourceRoot}/main.ts`,
    'lint:fix': 'eslint . --fix',
    'hooks:install': 'lefthook install',
    'check:arch': 'ddd-ts-kit check',
    depcruise: `ddd-ts-kit depcruise-config --check && depcruise ${config.sourceRoot} --config ${DEPCRUISE_FILE}`,
    'ci:arch:graph': 'npm run depcruise',
    deadcode: 'knip',
    quality: 'npm run lint && npm run check:arch && npm run depcruise && npm run deadcode',
    ...testScripts(config),
    ...documentationScripts(config),
    ...databaseScripts(config.stack.orm),
    'infra:up': 'docker compose up -d --wait',
    'infra:down': 'docker compose down',
  };
  const gates = GATES.filter((gate) => gate in scripts);
  return { ...scripts, verify: gates.map((gate) => `npm run ${gate}`).join(' && ') };
}

const JEST = 'node --experimental-vm-modules node_modules/jest/bin/jest.js';

function testScripts(config: Config): Record<string, string> {
  const { http, tests } = config.stack;
  const noEndToEnd = { 'ci:test:e2e': 'echo "No HTTP stack: nothing to drive end to end."' };
  if (tests === 'jest') {
    const endToEnd = `${JEST} --config jest.e2e.config.js --passWithNoTests`;
    return { test: JEST, 'ci:test:unit': JEST, 'ci:test:integration': 'echo "Adapter specs run with the unit specs under jest."', ...(http === 'none' ? noEndToEnd : { 'test:e2e': endToEnd, 'ci:test:e2e': endToEnd }) };
  }
  return { test: 'vitest run', ...(http === 'none' ? noEndToEnd : { 'test:e2e': 'vitest run --config vitest.e2e.config.ts --passWithNoTests' }) };
}

function documentationScripts(config: Config): Record<string, string> {
  const hasHttp = config.stack.http !== 'none';
  const generated = [...(hasHttp ? ['node dist/scripts/openapi.js'] : []), 'node dist/scripts/events.js'];
  return {
    ...(hasHttp ? { 'openapi:generate': 'npm run build && node dist/scripts/openapi.js', 'openapi:check': 'npm run build && node dist/scripts/openapi.js --check' } : {}),
    'events:generate': 'npm run build && node dist/scripts/events.js',
    'events:check': 'npm run build && node dist/scripts/events.js --check',
    'docs:generate': `ddd-ts-kit docs && npm run build && ${generated.join(' && ')}`,
    'docs:check': `ddd-ts-kit docs --check && npm run build && ${generated.map((command) => `${command} --check`).join(' && ')}`,
  };
}

/** The pipelines call `db:migrate` before the adapter specs whatever the stack: without a database it says so and succeeds. */
const DATABASE_SCRIPTS: Readonly<Record<string, Record<string, string>>> = {
  none: { 'db:migrate': 'echo "No database to migrate."' },
  custom: { 'db:migrate': 'echo "Custom persistence: run your own migrations here."' },
  drizzle: { 'db:generate': 'drizzle-kit generate', 'db:migrate': 'drizzle-kit migrate' },
  knex: { 'db:generate': 'knex migrate:make', 'db:migrate': 'npm run build && knex migrate:latest' },
  typeorm: {
    'db:generate': 'typeorm migration:generate -d dist/src/platform/database/data-source.js migrations/change',
    'db:migrate': 'typeorm migration:run -d dist/src/platform/database/data-source.js',
  },
  // The client and the schema of the tests are build products of prisma/schema.prisma: every entry point refreshes them.
  prisma: {
    'db:client': 'prisma generate && prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script -o generated/schema.sql',
    'db:generate': 'prisma migrate dev --create-only',
    'db:migrate': 'prisma migrate deploy',
    pretypecheck: 'npm run db:client',
    prebuild: 'npm run db:client',
    pretest: 'npm run db:client',
    'pretest:e2e': 'npm run db:client',
  },
};

function databaseScripts(orm: string): Record<string, string> {
  return DATABASE_SCRIPTS[orm] ?? {};
}

interface Packages {
  readonly dependencies: Record<string, string>;
  readonly devDependencies: Record<string, string>;
}

const BASE = ['@ddd-ts-kit/kernel', '@ddd-ts-kit/events', '@ddd-ts-kit/validation', '@ddd-ts-kit/tracing', '@opentelemetry/api', '@opentelemetry/sdk-node', '@opentelemetry/auto-instrumentations-node', '@opentelemetry/exporter-trace-otlp-http'];
const BASE_DEV = ['ddd-ts-kit', 'tsx', '@types/node', '@ddd-ts-kit/testing', '@faker-js/faker'];

/** What each choice of the stack adds: [runtime dependencies, development dependencies]. */
const BY_CHOICE: Readonly<Record<string, readonly [readonly string[], readonly string[]]>> = {
  'http:express': [['@ddd-ts-kit/http', 'express'], ['@types/express']],
  'http:fastify': [['@ddd-ts-kit/http', 'fastify'], []],
  'http:nest': [['@ddd-ts-kit/http', '@nestjs/common', '@nestjs/core', '@nestjs/platform-express', 'reflect-metadata', 'rxjs'], []],
  'di:tsyringe': [['@ddd-ts-kit/di', 'tsyringe', 'reflect-metadata'], []],
  'validation:zod': [['zod'], []],
  'validation:class-validator': [['class-validator', 'class-transformer', 'class-validator-jsonschema', 'reflect-metadata'], []],
  'orm:drizzle': [['@ddd-ts-kit/drizzle', 'drizzle-orm', 'pg'], ['drizzle-kit', '@types/pg', '@electric-sql/pglite']],
  'orm:knex': [['@ddd-ts-kit/knex', 'knex', 'pg'], ['@types/pg', '@electric-sql/pglite', '@electric-sql/pglite-socket']],
  'orm:prisma': [['@ddd-ts-kit/prisma', '@prisma/client', '@prisma/adapter-pg', 'pg'], ['prisma', '@types/pg', '@electric-sql/pglite', '@electric-sql/pglite-socket']],
  'orm:typeorm': [['@ddd-ts-kit/typeorm', 'typeorm', 'pg'], ['@types/pg', '@electric-sql/pglite', '@electric-sql/pglite-socket']],
  'tests:vitest': [[], ['vitest']],
  'tests:jest': [[], ['jest', '@jest/globals', '@swc/core', '@swc/jest']],
};

function dependenciesFor(config: Config): Packages {
  const choices = Object.entries(config.stack).map(([key, value]) => BY_CHOICE[`${key}:${value}`] ?? [[], []]);
  const ranges = (names: readonly string[]): Record<string, string> => Object.fromEntries(names.map((name) => [name, VERSIONS[name] ?? 'latest']));
  const development = { ...ranges([...BASE_DEV, ...choices.flatMap(([, names]) => names)]), ...analyzers(config) };
  return {
    dependencies: sorted(ranges([...BASE, ...choices.flatMap(([runtime]) => runtime)])),
    devDependencies: sorted(development),
  };
}

/** The analyzers of the pipeline, at its versions. The GitLab report formatter only where a GitLab pipeline uses it. */
function analyzers(config: Config): Record<string, string> {
  const { 'eslint-formatter-gitlab': gitlabFormatter, ...common } = pipelineManifest().devDependencies;
  const usesGitlab = config.stack.ci === 'gitlab' || config.stack.ci === 'both';
  return { ...common, ...(usesGitlab && gitlabFormatter !== undefined ? { 'eslint-formatter-gitlab': gitlabFormatter } : {}) };
}

function sorted(entries: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(entries).sort(([left], [right]) => left.localeCompare(right)));
}

/** The `ci:*` scripts and the analyzers they need, as the pipeline ships them. */
interface PipelineManifest {
  readonly scripts: Record<string, string>;
  readonly devDependencies: Record<string, string>;
}

function pipelineManifest(): PipelineManifest {
  const parsed: unknown = JSON.parse(readTemplate('pipeline/package-scripts.json'));
  const part = (key: string): Record<string, string> => {
    const value: unknown = isRecord(parsed) ? parsed[key] : undefined;
    return isRecord(value) ? Object.fromEntries(Object.entries(value).map(([name, entry]) => [name, String(entry)])) : {};
  };
  return { scripts: part('scripts'), devDependencies: part('devDependencies') };
}
