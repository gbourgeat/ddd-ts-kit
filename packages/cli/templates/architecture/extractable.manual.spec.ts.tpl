import { describe, expect, it } from '{{tests.module}}';
import { createPlatform } from '{{alias.platform}}/composition/create-platform{{alias.ext}}';
import { inertPersistence } from '{{alias.platform}}/database/inert-persistence{{alias.ext}}';
import { inProcessEvents } from '{{alias.platform}}/events/in-process-events{{alias.ext}}';
import type { Platform } from '{{alias.platform}}/composition/platform{{alias.ext}}';
// ddd-ts-kit:imports
// /ddd-ts-kit:imports

const contexts: readonly (readonly [string, (platform: Platform) => { readonly name: string }])[] = [
  // ddd-ts-kit:contexts
  // /ddd-ts-kit:contexts
];

describe('A bounded context is a deployable unit in waiting', () => {
  it('the platform wires alone, before the first context joins it', () => {
    expect(() => createPlatform(inertPersistence(), { events: inProcessEvents() })).not.toThrow();
  });

  // Jest refuses a table without rows: until the first context joins the project, its cases wait.
  if (contexts.length === 0) {
    it.todo('wires each context alone, with its scheduled jobs, once the project has one');
  } else {
    it.each(contexts)('%s wires alone, on the platform, with no other context', (name, module) => {
      const platform = createPlatform(inertPersistence(), { events: inProcessEvents() });

      expect(module(platform).name).toBe(name);
    });

    it.each(contexts)('%s takes its scheduled jobs with it, and no job of another context', (name, module) => {
      const platform = createPlatform(inertPersistence(), { events: inProcessEvents() });

      module(platform);

      expect(platform.jobs.describe().filter((job) => !job.name.startsWith(name + '.'))).toEqual([]);
    });
  }
});
