{{#if tests.vitest}}
import { afterAll, beforeAll, beforeEach, describe, it, onTestFailed } from 'vitest';
{{/if}}
{{#if tests.jest}}
import { afterAll, beforeAll, beforeEach, describe, it } from '@jest/globals';
{{/if}}
{{#if tests.vitest}}
import { reportSeedOnFailure } from '@ddd-ts-kit/testing/faker';
{{/if}}
import { startApplication, type RunningApplication } from '{{alias.test}}/e2e/support/start-application{{alias.ext}}';

// No route starts "{{name.words}}": {{e2e.jobs}} sends its command when its schedule is due, so the spec runs the job as the scheduler would.
describe('{{name.title}}, end to end', () => {
  let application: RunningApplication;

  beforeAll(async () => {
    application = await startApplication();
  });

  afterAll(async () => {
    await application.close();
  });

  beforeEach(async () => {
    await application.reset();
  });
{{#if tests.vitest}}

  reportSeedOnFailure({ beforeEach, onTestFailed });
{{/if}}

{{e2e.cases}}
{{#if e2e.readable}}

  // TODO(domain): replace each entry below by a test of what a client or another context observes once `await application.settled()` has resolved: the answers of {{e2e.reads}}, then the integration events (`collectEvents(application.events, [...])`); never a fixed delay, never the database.
  it.todo('lets a client observe the outcome of "{{name.words}}" through the API');
{{/if}}
{{#unless e2e.readable}}

  // TODO(domain): replace each entry below by a test of what another context observes once `await application.settled()` has resolved: the integration events "{{name.words}}" publishes (`collectEvents(application.events, [...])`), or the answer of a route that reads what it changed; never a fixed delay, never the database.
{{/unless}}
  it.todo('publishes the integration events other contexts rely on');
});
