export default {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/{{config.sourceRoot}}/**/*.spec.ts', '<rootDir>/test/architecture/**/*.spec.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': ['@swc/jest', { jsc: { parser: { syntax: 'typescript', decorators: true }, transform: { legacyDecorator: true, decoratorMetadata: true }, target: 'es2022' } }],
  },
  moduleNameMapper: {
    '^{{alias.bare}}/(.*)\\.js$': '<rootDir>/{{config.sourceRoot}}/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
