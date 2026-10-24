import base from './jest.config.js';

// The specs Stryker runs against each mutant of the domain: the unit specs, which need no database and answer in milliseconds; the integration specs would pay a database per mutant for nothing a unit spec does not already notice.
export default {
  ...base,
  testMatch: ['<rootDir>/{{config.sourceRoot}}/**/*.spec.ts'],
  testPathIgnorePatterns: [...base.testPathIgnorePatterns, '/{{config.contextsDir}}/[^/]+/test/integration/'],
};
