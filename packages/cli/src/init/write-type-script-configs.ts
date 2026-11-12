import {
  aliasRoots,
  compilerPaths,
  compilerResolutionOf,
  DEFAULT_BUILD_LAYOUT,
  NEIGHBOUR_SOURCES,
  neighbourSuffix,
} from '../alias';
import type { Config } from '../config';
import { usesLegacyDecorators } from '../stack/uses-legacy-decorators';
import type { Workspace } from '../workspace';
import { formatJson } from '../json/format-json';

/** What the compiler reads beside the sources by ORM: the client Prisma generates, the migrations TypeORM writes in TypeScript. */
const ORM_FOLDERS: Readonly<Record<string, readonly string[]>> = { prisma: ['generated'], typeorm: ['migrations'] };

/**
 * `tsconfig.json` for the editor and the type check, `tsconfig.build.json` for what ships: no test,
 * no test database. `paths` declares the import alias for the compiler and for every tool that
 * reads tsconfig; the build config extends the other, so the two cannot disagree. How a specifier
 * is resolved follows "importExtension". Where the type check is let read a neighbour by the `.ts`
 * of its source, which requires a configuration that emits nothing, the build sets both back: what
 * it compiles is what it compiled without them.
 */
export function writeTypeScriptConfigs(ws: Workspace, config: Config): void {
  const orm = ORM_FOLDERS[config.stack.orm] ?? [];
  const include = [config.sourceRoot, 'scripts', 'test', ...orm];

  ws.create('tsconfig.json', serialize({ compilerOptions: compilerOptions(config), include }));

  ws.create(
    'tsconfig.build.json',
    serialize({
      extends: './tsconfig.json',
      ...(readsNeighbourSources(config) ? { compilerOptions: NEIGHBOUR_SOURCES.build } : {}),
      exclude: ['test', '**/test/**', '**/*.spec.ts', '**/open-test-database.ts'],
    }),
  );
}

function compilerOptions(config: Config): Record<string, unknown> {
  return {
    target: 'ES2023',
    lib: ['ES2023'],
    ...compilerResolutionOf(config.importExtension),
    strict: true,
    noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true,
    noImplicitOverride: true,
    verbatimModuleSyntax: true,
    ...(readsNeighbourSources(config) ? NEIGHBOUR_SOURCES.typeCheck : {}),
    skipLibCheck: true,
    ...(usesLegacyDecorators(config) ? { experimentalDecorators: true, emitDecoratorMetadata: true } : {}),
    types: ['node'],
    rootDir: DEFAULT_BUILD_LAYOUT.rootDir,
    outDir: DEFAULT_BUILD_LAYOUT.outDir,
    paths: compilerPaths(aliasRoots(config)),
  };
}

/**
 * The files of `test/support/` a test runner loads as its global setup import one another by a
 * relative path, before any alias exists: where the compiler requires an extension it is the `.ts`
 * of the source, which the type check is let read.
 */
function readsNeighbourSources(config: Config): boolean {
  return neighbourSuffix(config.importExtension) !== '';
}

function serialize(value: unknown): string {
  return formatJson(value);
}
