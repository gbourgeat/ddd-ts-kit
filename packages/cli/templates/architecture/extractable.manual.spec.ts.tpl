import { describe, expect, it } from '{{tests.module}}';
import { createPlatform } from '{{alias.platform}}/create-platform.js';
import { inertPersistence } from '{{alias.platform}}/database/inert-persistence.js';
import { inProcessEvents } from '{{alias.platform}}/events/in-process-events.js';
import type { Platform } from '{{alias.platform}}/platform.js';
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

  it.each(contexts)('%s wires alone, on the platform, with no other context', (name, module) => {
    const platform = createPlatform(inertPersistence(), { events: inProcessEvents() });

    expect(module(platform).name).toBe(name);
  });

  it.each(contexts)('%s takes its scheduled jobs with it, and no job of another context', (name, module) => {
    const platform = createPlatform(inertPersistence(), { events: inProcessEvents() });

    module(platform);

    expect(platform.jobs.describe().filter((job) => !job.name.startsWith(name + '.'))).toEqual([]);
  });
});
