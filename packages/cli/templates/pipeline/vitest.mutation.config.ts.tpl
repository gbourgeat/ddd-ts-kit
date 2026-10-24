{{#if decorators.standard}}
import { decorators } from '@ddd-ts-kit/testing/vitest';
{{/if}}
{{#if decorators.legacy}}
import { decoratorCoverage } from '@ddd-ts-kit/testing/vitest';
{{/if}}
import { defineConfig } from 'vitest/config';

// The specs Stryker runs against each mutant of the domain: the unit specs, which need no database and answer in milliseconds; the integration specs would pay a database per mutant for nothing a unit spec does not already notice.
export default defineConfig({
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
    include: ['{{config.sourceRoot}}/**/*.spec.ts'],
    exclude: ['{{config.contextsDir}}/*/test/integration/**'],
    {{#if assembly.discovery}}
    // Discovery imports the role files of a context itself: inlined, the package loads them through the runner, which compiles them.
    server: { deps: { inline: ['@ddd-ts-kit/di'] } },
    {{/if}}
  },
});
