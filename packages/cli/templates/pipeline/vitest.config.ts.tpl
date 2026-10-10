import { fileURLToPath } from 'node:url';
{{#if decorators.standard}}
import { decorators } from '@ddd-ts-kit/testing/vitest';
{{/if}}
import { defineConfig } from 'vitest/config';

const INTEGRATION_SPECS = '{{config.contextsDir}}/*/test/integration/**/*.spec.ts';
const INTEGRATION_MODE = 'integration';

export default defineConfig(({ mode }) => ({
{{#if decorators.standard}}
  // Vitest does not lower standard (TC39) decorators, which every class of a declared context carries: the compiler the project builds with does.
  plugins: [decorators({ compiler: '@typescript/native' })],
{{/if}}
  resolve: { alias: { '{{alias.bare}}': fileURLToPath(new URL('./{{config.sourceRoot}}', import.meta.url)) } },
  test: {
{{#if assembly.discovery}}
    // Discovery imports the role files of a context itself: inlined, the package loads them through the runner, which compiles them.
    server: { deps: { inline: ['@ddd-ts-kit/di'] } },
{{/if}}
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
