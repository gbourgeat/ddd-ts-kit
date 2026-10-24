import { governedCoverage, unaffectedContexts } from '@ddd-ts-kit/testing/coverage';
import { decoratorCoverage } from '@ddd-ts-kit/testing/vitest';
import { defineConfig } from 'vitest/config';

const INTEGRATION_SPECS = 'src/contexts/*/test/integration/**/*.spec.ts';
const INTEGRATION_MODE = 'integration';
// A pull request names the contexts its change reaches (DDD_TS_KIT_AFFECTED, from `ddd-ts-kit affected`): the specs of the others are left to the default branch.
const NOT_AFFECTED = unaffectedContexts().map((directory) => `${directory}**`);
// A developer machine shares its cores with the editor, the coding agents and their worktrees: the specs take half of them. A pipeline runner has its own.
const WORKERS = process.env.CI ? {} : { maxWorkers: '50%' };

export default defineConfig(({ mode }) => ({
  // Under `emitDecoratorMetadata` the transform guards every type a decorated class names with a branch no test can take: the statements that apply decorators are kept out of the measure.
  plugins: [decoratorCoverage()],
  // An import alias is resolved from the "paths" of tsconfig.json, which name the sources.
  resolve: { tsconfigPaths: true },
  test: {
    ...WORKERS,
    // Each spec file is held to the time budget of its level ("budget" in ddd-ts-kit.config.json, the reference when it is absent): the slowest named at the end of the run, a file over its budget fails it.
    reporters: ['default', '@ddd-ts-kit/testing/budget/vitest'],
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.spec.ts', 'test/architecture/**/*.spec.ts'],
          exclude: [INTEGRATION_SPECS, ...NOT_AFFECTED],
        },
      },
      { extends: true, test: { name: INTEGRATION_MODE, include: [INTEGRATION_SPECS], exclude: NOT_AFFECTED } },
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
