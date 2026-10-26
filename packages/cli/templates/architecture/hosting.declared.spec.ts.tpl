import { readFileSync } from 'node:fs';
import { describe, expect, it } from '{{tests.module}}';
{{#if http.any}}
import { offlineAuthenticator } from '{{alias.platform}}/auth/authentication/offline-authenticator{{alias.ext}}';
{{/if}}
import { composeApplication, everyContext } from '{{alias.platform}}/composition/compose-application{{alias.ext}}';
import { inertPersistence } from '{{alias.platform}}/database/inert-persistence{{alias.ext}}';
import { inProcessEvents } from '{{alias.platform}}/events/in-process-events{{alias.ext}}';

/** The contexts run as services of their own: `ddd-ts-kit generate service` adds one. */
const extracted: readonly string[] = [
  // ddd-ts-kit:extracted
  // /ddd-ts-kit:extracted
];

const options = {
  events: inProcessEvents(),
{{#if http.any}}
  authenticator: offlineAuthenticator,
{{/if}}
};

describe('A context run as a service leaves the whole application', () => {
  // Jest refuses a table without rows: until a context becomes a service, its cases wait.
  if (extracted.length === 0) {
    it.todo('leaves the jobs of the platform to the whole application, once the project has a service');
  } else {
    it.each(extracted)('%s: its service hosts it, and no job of the platform', (name) => {
      const service = composeApplication(
        inertPersistence(),
        { ...options, platformJobs: false },
        { modules: everyContext.modules.filter((module) => module.name === name) },
      ).container.describe();

      expect(service.modules).toContain(name);
      expect(service.jobs.filter((job) => !job.name.startsWith(name + '.'))).toEqual([]);
    });

    it.each(extracted)('%s: its entry point leaves the jobs of the platform to the whole application', (name) => {
      expect(readFileSync('{{config.sourceRoot}}/apps/' + name + '/main.ts', 'utf8')).toContain('platformJobs: false');
    });
  }
});
