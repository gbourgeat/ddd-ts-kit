import base from './jest.config.js';

export default {
  ...base,
  testMatch: ['<rootDir>/test/e2e/**/*.e2e.spec.ts', '<rootDir>/test/acceptance/**/*.acceptance.spec.ts'],
  testTimeout: 20000,
  maxWorkers: 1,
};
