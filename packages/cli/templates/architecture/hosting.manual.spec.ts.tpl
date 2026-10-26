import { readFileSync } from 'node:fs';
import { describe, expect, it } from '{{tests.module}}';

/** The contexts run as services of their own: `ddd-ts-kit generate service` adds one. */
const extracted: readonly string[] = [
  // ddd-ts-kit:extracted
  // /ddd-ts-kit:extracted
];

describe('A context run as a service leaves the whole application', () => {
  // Jest refuses a table without rows: until a context becomes a service, its cases wait.
  if (extracted.length === 0) {
    it.todo('leaves the jobs of the platform to the whole application, once the project has a service');
  } else {
    it.each(extracted)('%s: its entry point leaves the jobs of the platform to the whole application', (name) => {
      expect(readFileSync('{{config.sourceRoot}}/apps/' + name + '/main.ts', 'utf8')).toContain('platformJobs: false');
    });
  }
});
