import process from 'node:process';
import { governedJestCoverage, unaffectedContexts } from '@ddd-ts-kit/testing/coverage';

export default {
  testEnvironment: 'node',
  // Jest does not read tsconfig: the import aliases of its "paths", repeated here, and held equal by `ddd-ts-kit check` (imports/alias-declared).
  moduleNameMapper: {
    {{alias.jestMapper}}
{{#if orm.prisma}}
    // The client `prisma generate` writes names its own modules with `.js`: they are TypeScript sources, which Jest transforms.
    '^(\\.{1,2}/.*)\\.js$': '$1',
{{/if}}
  },
  testMatch: ['<rootDir>/{{config.sourceRoot}}/**/*.spec.ts', '<rootDir>/test/architecture/**/*.spec.ts'],
{{#if persistence.hasDatabase}}
  // PostgreSQL in process is initialised once per run, and each spec opens a copy of that cluster instead of an initdb of its own.
  globalSetup: '<rootDir>/test/support/test-database-template.ts',
  globalTeardown: '<rootDir>/test/support/test-database-teardown.ts',
  // A hook opens a copy of that cluster and creates its tables, or reaches a server: on a busy machine it can outlast the 5 seconds Jest gives a test and its hooks, as Vitest is given 60.
{{/if}}
{{#unless persistence.hasDatabase}}
  // A hook opens the test database: on a busy machine it can outlast the 5 seconds Jest gives a test and its hooks, as Vitest is given 60.
{{/unless}}
  testTimeout: 60_000,
  // Each spec file is held to the time budget of its level ("budget" in ddd-ts-kit.config.json, the reference when it is absent): the slowest named at the end of the run, a file over its budget fails it.
  reporters: ['default', '@ddd-ts-kit/testing/budget/jest'],
  // A pull request names the contexts its change reaches (DDD_TS_KIT_AFFECTED, from `ddd-ts-kit affected`): the specs of the others are left to the default branch.
  testPathIgnorePatterns: ['/node_modules/', ...unaffectedContexts().map((directory) => `/${directory}`)],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', decorators: true },
{{#if decorators.legacy}}
          // A library of the stack only has legacy decorators: the whole program is compiled in that mode, with the metadata it reads.
          transform: { legacyDecorator: true, decoratorMetadata: true },
{{/if}}
{{#if decorators.standard}}
          // Standard decorators, as `tsc` emits them for this project: no `experimentalDecorators` in tsconfig.json.
          transform: { decoratorVersion: '2022-03' },
{{/if}}
          target: 'es2022',
        },
      },
    ],
  },
  // A developer machine shares its cores with the editor, the coding agents and their worktrees: the specs take half of them. A pipeline runner has its own.
  ...(process.env.CI ? {} : { maxWorkers: '50%' }),
  // Babel instruments the code @swc/jest has transformed: two to three times faster than `v8` on a grown project, the same branches as the `v8` provider of Vitest. A line left out of the measure carries `istanbul ignore`, the hint it reads.
  coverageProvider: 'babel',
  coverageReporters: ['text', 'cobertura', 'lcov'],
  coverageDirectory: 'coverage',
  // What is measured and the floor of each layer come from "coverage" in ddd-ts-kit.config.json, the reference when it is absent: a threshold is written nowhere else.
  ...governedJestCoverage(),
};
