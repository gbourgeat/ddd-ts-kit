import { governedCoverage } from '@ddd-ts-kit/testing/coverage';
{{#if decorators.standard}}
import { decorators } from '@ddd-ts-kit/testing/vitest';
{{/if}}
{{#if decorators.legacy}}
import { decoratorCoverage } from '@ddd-ts-kit/testing/vitest';
{{/if}}
import { defineConfig } from 'vitest/config';

const INTEGRATION_SPECS = '{{config.contextsDir}}/*/test/integration/**/*.spec.ts';
const INTEGRATION_MODE = 'integration';

export default defineConfig(({ mode }) => ({
  {{#if decorators.standard}}
  // Vitest does not lower standard (TC39) decorators, which every class of a declared context carries: the compiler the project builds with does.
  plugins: [decorators({ compiler: '@typescript/native' })],
  {{/if}}
  {{#if decorators.legacy}}
  // Under `emitDecoratorMetadata` the transform guards every type a decorated class names with a branch no test can take: the statements that apply decorators are kept out of the measure.
  plugins: [decoratorCoverage()],
  {{/if}}
  // Under this condition an import alias answers the source file, not the compiled one (package.json, "imports").
  ssr: { resolve: { conditions: ['{{alias.condition}}'] } },
  test: {
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
          exclude: [INTEGRATION_SPECS],
        },
      },
      { extends: true, test: { name: INTEGRATION_MODE, include: [INTEGRATION_SPECS] } },
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
