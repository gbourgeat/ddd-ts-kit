import { DEFAULT_BUILD_LAYOUT } from '../alias/index.js';
import type { Config } from '../config/index.js';
import { usesLegacyDecorators } from '../stack/uses-legacy-decorators.js';
import type { Workspace } from '../workspace/index.js';
import { formatJson } from '../json/format-json.js';

/**
 * `tsconfig.json` for the editor and the type check, `tsconfig.build.json` for what ships: no test,
 * no test database. Neither names the import alias: the compiler reads it from package.json and
 * maps the compiled file it finds there back to its source through `rootDir` and `outDir`.
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
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
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
  };
}

function serialize(value: unknown): string {
  return formatJson(value);
}
