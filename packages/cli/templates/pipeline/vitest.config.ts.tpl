import { governedCoverage, unaffectedContexts } from '@ddd-ts-kit/testing/coverage';
{{#if decorators.standard}}
import { decorators } from '@ddd-ts-kit/testing/vitest';
{{/if}}
{{#if decorators.legacy}}
import { decoratorCoverage } from '@ddd-ts-kit/testing/vitest';
{{/if}}
import { defineConfig } from 'vitest/config';

const INTEGRATION_SPECS = '{{config.contextsDir}}/*/test/integration/**/*.spec.ts';
const INTEGRATION_MODE = 'integration';
// A pull request names the contexts its change reaches (DDD_TS_KIT_AFFECTED, from `ddd-ts-kit affected`): the specs of the others are left to the default branch.
const NOT_AFFECTED = unaffectedContexts().map((directory) => `${directory}**`);

export default defineConfig(({ mode }) => ({
  {{#if decorators.standard}}
  // Vitest does not lower standard (TC39) decorators, which every class of a declared context carries: the compiler the project builds with does.
  plugins: [decorators({ compiler: '@typescript/native' })],
  {{/if}}
  {{#if decorators.legacy}}
  // Under `emitDecoratorMetadata` the transform guards every type a decorated class names with a branch no test can take: the statements that apply decorators are kept out of the measure.
  plugins: [decoratorCoverage()],
  {{/if}}
  // An import alias is resolved from the "paths" of tsconfig.json, which name the sources.
  resolve: { tsconfigPaths: true },
  test: {
    // The integration project has no spec before the first repository or adapter of the project: its run passes until then.
    passWithNoTests: mode === INTEGRATION_MODE,
    {{#if assembly.discovery}}
    // Discovery imports the role files of a context itself: inlined, the package loads them through the runner, which compiles them.
    server: { deps: { inline: ['@ddd-ts-kit/di'] } },
    {{/if}}
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['{{config.sourceRoot}}/**/*.spec.ts', 'test/architecture/**/*.spec.ts'],
          exclude: [INTEGRATION_SPECS, ...NOT_AFFECTED],
        },
      },
      {
        extends: true,
        test: {
          name: INTEGRATION_MODE,
          include: [INTEGRATION_SPECS],
          exclude: NOT_AFFECTED,
          // A hook opens the test database (PGlite started and its tables created, or a server reached): under coverage on a busy machine it outlasts the default 10 seconds.
          hookTimeout: 60_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'cobertura', 'lcov'],
      reportsDirectory: 'coverage',
      // What is measured and the floor of each layer come from "coverage" in ddd-ts-kit.config.json, the reference when it is absent: a threshold is written nowhere else.
      ...governedCoverage(mode),
    },
  },
}));
