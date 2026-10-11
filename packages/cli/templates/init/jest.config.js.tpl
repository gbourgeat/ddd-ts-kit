import { governedJestCoverage, unaffectedContexts } from '@ddd-ts-kit/testing/coverage';

export default {
  testEnvironment: 'node',
  // Jest does not read tsconfig: the import aliases of its "paths", repeated here, and held equal by `ddd-ts-kit check` (imports/alias-declared).
  moduleNameMapper: {
    {{alias.jestMapper}}
  },
  testMatch: ['<rootDir>/{{config.sourceRoot}}/**/*.spec.ts', '<rootDir>/test/architecture/**/*.spec.ts'],
  // A pull request names the contexts its change reaches (DDD_TS_KIT_AFFECTED, from `ddd-ts-kit affected`): the specs of the others are left to the default branch.
  testPathIgnorePatterns: ['/node_modules/', ...unaffectedContexts().map((directory) => `/${directory}`)],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', decorators: true },
          transform: { legacyDecorator: true, decoratorMetadata: true },
          target: 'es2022',
        },
      },
    ],
  },
  coverageProvider: 'v8',
  coverageReporters: ['text', 'cobertura', 'lcov'],
  coverageDirectory: 'coverage',
  // What is measured and the floor of each layer come from "coverage" in ddd-ts-kit.config.json, the reference when it is absent: a threshold is written nowhere else.
  ...governedJestCoverage(),
};
