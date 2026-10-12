import { aliasRoots, compilerPaths, compilerResolutionOf, DEFAULT_BUILD_LAYOUT } from '../alias/index.js';
import type { Config } from '../config/index.js';
import { usesLegacyDecorators } from '../stack/uses-legacy-decorators.js';
import type { Workspace } from '../workspace/index.js';
import { formatJson } from '../json/format-json.js';

/**
 * `tsconfig.json` for the editor and the type check, `tsconfig.build.json` for what ships: no test,
 * no test database. `paths` declares the import alias for the compiler and for every tool that
 * reads tsconfig; the build config extends the other, so the two cannot disagree. How a specifier
 * is resolved follows "importExtension".
 */
export function writeTypeScriptConfigs(ws: Workspace, config: Config): void {
  const include = [config.sourceRoot, 'scripts', 'test', ...(config.stack.orm === 'prisma' ? ['generated'] : [])];

  ws.create('tsconfig.json', serialize({ compilerOptions: compilerOptions(config), include }));

  ws.create(
    'tsconfig.build.json',
    serialize({
      extends: './tsconfig.json',
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
    skipLibCheck: true,
    ...(usesLegacyDecorators(config) ? { experimentalDecorators: true, emitDecoratorMetadata: true } : {}),
    types: ['node'],
    rootDir: DEFAULT_BUILD_LAYOUT.rootDir,
    outDir: DEFAULT_BUILD_LAYOUT.outDir,
    paths: compilerPaths(aliasRoots(config)),
  };
}

function serialize(value: unknown): string {
  return formatJson(value);
}
