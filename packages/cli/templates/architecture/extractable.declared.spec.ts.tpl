import { describe, expect, it } from '{{tests.module}}';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { AllowAll } from '@ddd-ts-kit/auth/testing';
{{#if assembly.barrel}}
import { contextModule, createTestApplication, type ContextModule } from '@ddd-ts-kit/di';
{{/if}}
{{#if assembly.discovery}}
import { createTestApplication, type ContextModule } from '@ddd-ts-kit/di';
import { discoverContext } from '@ddd-ts-kit/di/discovery';
{{/if}}
import { platformTestModule } from '{{paths.architectureToSource}}/platform/platform.module.js';
// ddd-ts-kit:imports
// /ddd-ts-kit:imports

/** The authorization of the platform, with a model that grants everything: this proof is about wiring, not about rights. */
const authorization = authorizationModule({ authorizer: new AllowAll() });

const CONTEXTS: readonly (readonly [string, ContextModule])[] = [
  // ddd-ts-kit:contexts
  // /ddd-ts-kit:contexts
];

describe('A bounded context is a deployable unit in waiting', () => {
  it.each(CONTEXTS)('%s wires alone from its declarations, on the kernel and the platform, with no other context', (_name, module) => {
    expect(() => createTestApplication({ modules: [platformTestModule, authorization, module], authorization: 'optional' })).not.toThrow();
  });
});
