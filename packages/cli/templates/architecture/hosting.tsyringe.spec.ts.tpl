import { readFileSync } from 'node:fs';
import { describe, expect, it } from '{{tests.module}}';
import type { WiringDescription } from '@ddd-ts-kit/di';
{{#if http.any}}
import { offlineAuthenticator } from '{{alias.platform}}/auth/authentication/offline-authenticator{{alias.ext}}';
{{/if}}
import { composeApplication, everyContext, hostedContexts } from '{{alias.platform}}/composition/compose-application{{alias.ext}}';
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
    it.todo('hosts no consumer, process nor job of a context run as a service, once the project has one');
  } else {
    it.each(extracted)('%s: the whole application hosts none of its modules, consumers, processes nor jobs', (name) => {
      const whole = composeApplication(inertPersistence(), options, hostedContexts).container.describe();

      expect(whole.modules).not.toContain(name);
      expect(registrationsOf(whole, name)).toEqual([]);
    });

    it.each(extracted)('%s: its service hosts it, each consumer once, and no job of the platform', (name) => {
      const service = composeApplication(
        inertPersistence(),
        { ...options, platformJobs: false },
        { modules: everyContext.modules.filter((module) => module.name === name) },
      ).container.describe();

      const consumers = service.integrationEventHandlers.map((handler) => `${handler.consumer}:${handler.event}`);

      expect(service.modules).toContain(name);
      expect(new Set(consumers).size).toBe(consumers.length);
      expect(service.jobs.filter((job) => !job.name.startsWith(name + '.'))).toEqual([]);
    });

    it.each(extracted)('%s: its entry point leaves the jobs of the platform to the whole application', (name) => {
      expect(readFileSync('{{config.sourceRoot}}/apps/' + name + '/main.ts', 'utf8')).toContain('platformJobs: false');
    });
  }
});

/** What a module registers to be driven by something other than a request: the reactions, the jobs, the projections. */
function registrationsOf(description: WiringDescription, name: string): readonly string[] {
  return [
    ...description.integrationEventHandlers,
    ...description.domainEventHandlers,
    ...description.projections,
    ...description.jobs,
    ...description.backgroundJobs,
    ...description.commands,
    ...description.queries,
  ]
    .filter(({ module }) => module === name)
    .map((registration) => JSON.stringify(registration));
}
