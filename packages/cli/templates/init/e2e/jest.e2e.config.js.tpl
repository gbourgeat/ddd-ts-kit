import base from './jest.config.js';

// Each spec file starts its own application, and its own PostgreSQL in process unless DATABASE_URL names a server.
// On a shared server the files cannot overlap (they would empty each other's tables): one worker, so Jest runs
// them in band, in one process that keeps the modules of every file it ran (about 15 MB of heap each with ES modules).
// A long suite there needs a larger heap: NODE_OPTIONS=--max-old-space-size=<MB>.
const sharedServer = (process.env.DATABASE_URL ?? '') !== '';

export default {
  ...base,
  testMatch: ['<rootDir>/test/e2e/**/*.e2e.spec.ts', '<rootDir>/test/acceptance/**/*.acceptance.spec.ts'],
  testTimeout: 20000,
  maxWorkers: sharedServer ? 1 : 2,
  // Out of band, a worker whose memory passes this after a file is replaced by a fresh one, so the heap of a long suite
  // stays bounded whatever the number of files. Jest ignores the limit in band, where the heap grows from file to file.
  workerIdleMemoryLimit: '800MB',
};
