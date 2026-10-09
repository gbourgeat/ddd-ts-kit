import { describe, expect, it } from '{{tests.module}}';
import { inertPersistence } from '{{paths.architectureToSource}}/platform/database/persistence.js';
import { inProcessEvents } from '{{paths.architectureToSource}}/platform/events.js';
import { createPlatform, type Platform } from '{{paths.architectureToSource}}/platform/platform.module.js';
// ddd-ts-kit:imports
// /ddd-ts-kit:imports

const CONTEXTS: readonly (readonly [string, (platform: Platform) => { readonly name: string }])[] = [
  // ddd-ts-kit:contexts
  // /ddd-ts-kit:contexts
];

describe('A bounded context is a deployable unit in waiting', () => {
  it.each(CONTEXTS)('%s wires alone, on the platform, with no other context', (name, wire) => {
    const platform = createPlatform(inertPersistence(), inProcessEvents());

    expect(wire(platform).name).toBe(name);
  });
});
