import { governedJestCoverage } from '@ddd-ts-kit/testing/coverage';

export default {
  testEnvironment: 'node',
  // Under this condition an import alias answers the source file, not the compiled one (package.json, "imports").
  testEnvironmentOptions: { customExportConditions: ['{{alias.condition}}', 'node', 'node-addons'] },
  testMatch: ['<rootDir>/{{config.sourceRoot}}/**/*.spec.ts', '<rootDir>/test/architecture/**/*.spec.ts'],
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
