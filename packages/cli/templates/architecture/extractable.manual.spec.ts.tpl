import { describe, expect, it } from '{{tests.module}}';
import { createPlatform } from '{{paths.architectureToSource}}/platform/create-platform.js';
import { inertPersistence } from '{{paths.architectureToSource}}/platform/database/inert-persistence.js';
import { inProcessEvents } from '{{paths.architectureToSource}}/platform/events/in-process-events.js';
import type { Platform } from '{{paths.architectureToSource}}/platform/platform.js';
// ddd-ts-kit:imports
// /ddd-ts-kit:imports

const contexts: readonly (readonly [string, (platform: Platform) => { readonly name: string }])[] = [
  // ddd-ts-kit:contexts
  // /ddd-ts-kit:contexts
];

describe('A bounded context is a deployable unit in waiting', () => {
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
