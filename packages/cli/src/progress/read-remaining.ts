import type { Config } from '../config';
import { filesUnder } from '../generate/files-under';
import { type ContextTree, roleDirectoriesOf, treeOf } from '../model-modules';
import type { Workspace } from '../workspace';
import { PRISMA_SCHEMA, prismaBlocks, schemaAt, schemaOfContext } from '../prisma-schema';
import type { Remaining } from './remaining';
import { remainingIn } from './remaining-in';

const E2E = 'test/e2e';
/** Every kind of file a generator writes a marker into, or a person may: the code, the pages, the schema of an ORM, the migrations, the configuration. */
const READ = /\.(?:[cm]?[jt]s|md|prisma|sql|json|ya?ml|toml)$/;
/** At the root of the project, its configuration only: a README or an AGENTS.md names the markers without being one. */
const ROOT_CONFIG = /\.(?:[cm]?[jt]s|json|ya?ml|toml)$/;
const LOCKFILES = new Set(['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock']);
/** The directories outside the contexts that hold the schema of Prisma and the migrations of every ORM. */
const STORAGE = ['prisma', 'migrations'];

/** Every marker left in the project, context by context then outside them; in one context only when `only` names it. */
export function readRemaining(ws: Workspace, config: Config, only?: string): Remaining[] {
  const contexts = ws.directories(config.contextsDir).filter((name) => only === undefined || name === only);
  const specs = ws.list(E2E).filter((file) => file.endsWith('.e2e.spec.ts'));

  const owner = (spec: string): string =>
    ws.directories(config.contextsDir).find((name) => drives(ws, treeOf(config, name), spec)) ?? '';

  return [
    ...contexts.flatMap((name) => scan(ws, name, `${config.contextsDir}/${name}`)),
    ...specs
      .flatMap((spec) => remainingIn(owner(spec), `${E2E}/${spec}`, ws.read(`${E2E}/${spec}`) ?? ''))
      .filter((left) => only === undefined || left.context === only),
    ...inPrismaSchema(ws, config).filter((left) => only === undefined || left.context === only),
    ...(only === undefined ? outside(ws, config) : []),
  ];
}

/** The markers of `prisma/schema.prisma`, each of the context whose database schema holds its model. */
function inPrismaSchema(ws: Workspace, config: Config): Remaining[] {
  const content = ws.read(PRISMA_SCHEMA);

  if (content === undefined) {
    return [];
  }

  const blocks = prismaBlocks(content.split('\n'));
  const contexts = new Map(ws.directories(config.contextsDir).map((name) => [schemaOfContext(name), name]));

  return remainingIn('', PRISMA_SCHEMA, content).map((left) => ({
    ...left,
    context: contexts.get(schemaAt(blocks, left.line - 1) ?? '') ?? '',
  }));
}

/** True when the end-to-end spec is named after a use case of the context. */
function drives(ws: Workspace, tree: ContextTree, spec: string): boolean {
  const useCase = spec.slice(0, -'.e2e.spec.ts'.length);

  return ['commands', 'queries'].some((folder) =>
    roleDirectoriesOf(ws, tree, `application/${folder}`).some(({ name }) => name === useCase),
  );
}

/**
 * What is left outside the contexts: the platform, the shared kernel, the documentation, the other
 * tests, the migrations, the configuration at the root.
 */
function outside(ws: Workspace, config: Config): Remaining[] {
  const readElsewhere = (file: string): boolean =>
    file.startsWith(`${config.contextsDir}/`) || file.startsWith(`${E2E}/`) || file === PRISMA_SCHEMA;

  const atRoot = ws
    .list('.')
    .filter((file) => ROOT_CONFIG.test(file) && !LOCKFILES.has(file))
    .flatMap((file) => remainingIn('', file, ws.read(file) ?? ''));

  return [
    ...[config.sourceRoot, 'docs', 'test', ...STORAGE]
      .flatMap((directory) => scan(ws, '', directory))
      .filter((left) => !readElsewhere(left.file)),
    ...atRoot,
  ];
}

function scan(ws: Workspace, context: string, directory: string): Remaining[] {
  return filesUnder(ws, directory)
    .filter((file) => READ.test(file))
    .flatMap((file) => remainingIn(context, `${directory}/${file}`, ws.read(`${directory}/${file}`) ?? ''));
}
