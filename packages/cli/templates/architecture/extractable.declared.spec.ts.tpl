import { describe, expect, it } from '{{tests.module}}';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { AllowAll } from '@ddd-ts-kit/auth/testing';
import { createTestApplication, type ContextModule } from '@ddd-ts-kit/di';
import { platformTestModule } from '{{alias.platform}}/composition/platform-test.module{{alias.ext}}';
// ddd-ts-kit:imports
// /ddd-ts-kit:imports

/** The authorization of the platform, with a model that grants everything: this proof is about wiring, not about rights. */
const authorization = authorizationModule({ authorizer: new AllowAll() });

const contexts: readonly (readonly [string, ContextModule])[] = [
  // ddd-ts-kit:contexts
  // /ddd-ts-kit:contexts
];

describe('A bounded context is a deployable unit in waiting', () => {
  it('the platform wires alone, before the first context joins it', () => {
    expect(() =>
      createTestApplication({ modules: [platformTestModule, authorization], authorization: 'optional' }),
    ).not.toThrow();
  });

  // Jest refuses a table without rows: until the first context joins the project, its cases wait.
  if (contexts.length === 0) {
    it.todo('wires each context alone, with its scheduled jobs, once the project has one');
  } else {
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
  }
});
