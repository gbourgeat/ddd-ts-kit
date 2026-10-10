import { describe, expect, it } from 'vitest';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { AllowAll } from '@ddd-ts-kit/auth/testing';
import { contextModule, createTestApplication, type ContextModule } from '@ddd-ts-kit/di';
import { platformTestModule } from '@/platform/platform-test.module.js';
// ddd-ts-kit:imports
import * as identityDeclarations from '@/contexts/identity/identity.declarations.js';
import * as schedulingDeclarations from '@/contexts/scheduling/scheduling.declarations.js';
import * as notificationDeclarations from '@/contexts/notification/notification.declarations.js';
import * as analyticsDeclarations from '@/contexts/analytics/analytics.declarations.js';
// /ddd-ts-kit:imports

/** The authorization of the platform, with a model that grants everything: this proof is about wiring, not about rights. */
const authorization = authorizationModule({ authorizer: new AllowAll() });

const contexts: readonly (readonly [string, ContextModule])[] = [
  // ddd-ts-kit:contexts
  ['identity', contextModule('identity', identityDeclarations)],
  ['scheduling', contextModule('scheduling', schedulingDeclarations)],
  ['notification', contextModule('notification', notificationDeclarations)],
  ['analytics', contextModule('analytics', analyticsDeclarations)],
  // /ddd-ts-kit:contexts
];

describe('A bounded context is a deployable unit in waiting', () => {
  it.each(contexts)(
    '%s wires alone from its declarations, on the kernel and the platform, with no other context',
    (_name, module) => {
      expect(() =>
        createTestApplication({ modules: [platformTestModule, authorization, module], authorization: 'optional' }),
      ).not.toThrow();
    },
  );

  it.each(contexts)('%s takes its scheduled jobs with it, and no job of another context', (name, module) => {
    const application = createTestApplication({
      modules: [platformTestModule, authorization, module],
      authorization: 'optional',
    });

    const jobs = application.describe().jobs.map((job) => job.name);

    expect(jobs.filter((job) => !job.startsWith(name + '.'))).toEqual([]);
    expect(application.jobs.scheduler.describe().map((job) => job.name)).toEqual(jobs);
  });
});
