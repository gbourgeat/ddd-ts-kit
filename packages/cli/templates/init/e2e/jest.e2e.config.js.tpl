{{#if endToEnd.sharedServer}}
import process from 'node:process';
{{/if}}
import base from './jest.config.js';

{{#if persistence.hasDatabase}}
// Each spec file starts its own application on a database of its own, PostgreSQL in process or a copy of the one
// DATABASE_URL names (test/support/test-database-clone.ts): two workers run the files at the same time, on a server too.
{{/if}}
{{#unless persistence.hasDatabase}}
// Each spec file starts its own application, which keeps what it stores in its own memory: two workers run the
// files at the same time.
{{/unless}}
{{#if endToEnd.sharedServer}}
// {{endToEnd.sharedBy}}:
// with {{endToEnd.sharedVariables}} set, one worker, so Jest runs the files in band, in one process that keeps the modules
// of every file it ran (about 15 MB of heap each with ES modules). A long suite there needs a larger heap:
// NODE_OPTIONS=--max-old-space-size=<MB>.
const sharedServer = {{endToEnd.sharedInJest}};
{{/if}}

export default {
  ...base,
  testMatch: ['<rootDir>/test/e2e/**/*.e2e.spec.ts', '<rootDir>/test/acceptance/**/*.acceptance.spec.ts'],
  testTimeout: 20000,
{{#if endToEnd.sharedServer}}
  maxWorkers: sharedServer ? 1 : 2,
  // Out of band, a worker whose memory passes this after a file is replaced by a fresh one, so the heap of a long suite
  // stays bounded whatever the number of files. Jest ignores the limit in band, where the heap grows from file to file.
{{/if}}
{{#unless endToEnd.sharedServer}}
  maxWorkers: 2,
  // A worker whose memory passes this after a file is replaced by a fresh one, so the heap of a long suite stays
  // bounded whatever the number of files.
{{/unless}}
  workerIdleMemoryLimit: '800MB',
};
