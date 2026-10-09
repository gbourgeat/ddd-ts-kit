import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { defineConfig, type Plugin } from 'vitest/config';

const INTEGRATION_SPECS = '{{config.contextsDir}}/*/test/integration/**/*.spec.ts';
const INTEGRATION_MODE = 'integration';

export default defineConfig(({ mode }) => ({
  plugins: [standardDecorators()],
  resolve: { alias: { '{{alias.bare}}': fileURLToPath(new URL('./{{config.sourceRoot}}', import.meta.url)) } },
  test: {
    projects: [
      { extends: true, test: { name: 'unit', include: ['{{config.sourceRoot}}/**/*.spec.ts', 'test/architecture/**/*.spec.ts'], exclude: [INTEGRATION_SPECS] } },
      { extends: true, test: { name: INTEGRATION_MODE, include: [INTEGRATION_SPECS] } },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'cobertura', 'lcov'],
      reportsDirectory: 'coverage',
      include: measuredLayers(mode),
      thresholds: {
        [layer('domain')]: { statements: 90, branches: 85, functions: 90, lines: 90 },
        [layer('application')]: { statements: 85, branches: 80, functions: 85, lines: 85 },
        [layer('presentation')]: { statements: 80, branches: 70, functions: 80, lines: 80 },
        [layer('infrastructure')]: { statements: 70, branches: 60, functions: 70, lines: 70 },
      },
    },
  },
}));

/**
 * Adapters are exercised by the integration project, the inner layers by the unit project:
 * `--mode integration` measures the first, any other mode the second, so that a run is never
 * failed for a layer it does not execute.
 */
function measuredLayers(mode: string): string[] {
  return mode === INTEGRATION_MODE ? [layer('infrastructure')] : [layer('domain'), layer('application'), layer('presentation')];
}

function layer(name: string): string {
  return `{{config.contextsDir}}/*/${name}/**/*.ts`;
}

/**
 * Vitest does not transform standard (TC39) decorators, which an adapter may carry from
 * `@ddd-ts-kit/aspects/decorators`. A file that holds one is therefore compiled here by
 * TypeScript, with the compiler options of the project and a source map, before the runner
 * reads it; every other file goes through the runner untouched. A project compiled with
 * `experimentalDecorators` has no standard decorator, and the runner handles its legacy ones.
 */
export function standardDecorators(): Plugin {
  const project: { config?: { compilerOptions?: unknown } } = ts.readConfigFile('tsconfig.json', (file) => ts.sys.readFile(file));
  const { options } = ts.convertCompilerOptionsFromJson(project.config?.compilerOptions ?? {}, '.');
  const compilerOptions = { ...options, module: ts.ModuleKind.ESNext, sourceMap: true, inlineSourceMap: false, declaration: false };
  return {
    name: 'standard-decorators',
    enforce: 'pre',
    transform(code, id) {
      if (options.experimentalDecorators === true || !id.endsWith('.ts') || !/^\s*@[A-Za-z_$]/m.test(code)) return null;
      const { outputText, sourceMapText } = ts.transpileModule(code, { fileName: id, compilerOptions });
      return { code: outputText.replace(/\n\/\/# sourceMappingURL=.*$/, ''), map: sourceMapText ?? null };
    },
  };
}
