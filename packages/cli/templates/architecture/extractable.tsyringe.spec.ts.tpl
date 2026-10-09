import { describe, expect, it } from '{{tests.module}}';
import { createTestApplication, type ContextModule } from '@ddd-ts-kit/di';
import { platformTestModule } from '{{paths.architectureToSource}}/platform/platform.module.js';
// ddd-ts-kit:imports
// /ddd-ts-kit:imports

const CONTEXTS: readonly (readonly [string, ContextModule])[] = [
  // ddd-ts-kit:contexts
  // /ddd-ts-kit:contexts
];

describe('A bounded context is a deployable unit in waiting', () => {
  it.each(CONTEXTS)('%s wires alone, on the kernel and the platform, with no other context', (_name, module) => {
    expect(() => createTestApplication({ modules: [platformTestModule, module], authorization: 'optional' })).not.toThrow();
  });
});
