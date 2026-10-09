{{#if tests.vitest}}
import { afterAll, beforeAll, beforeEach, describe, it, onTestFailed } from 'vitest';
{{/if}}
{{#if tests.jest}}
import { afterAll, beforeAll, beforeEach, describe, it } from '@jest/globals';
{{/if}}
import { expectStatus } from '@ddd-ts-kit/testing/e2e';
{{#if tests.vitest}}
import { reportSeedOnFailure } from '@ddd-ts-kit/testing/faker';
{{/if}}
import { startApplication, type RunningApplication } from './support/application.js';

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

  it('answers {{e2e.status}} to {{e2e.method}} {{e2e.path}}', async () => {
    // TODO(domain): arrange what "{{name.words}}" needs through the public API only (other routes), with the builders of test/builders and generated data; send a realistic request instead of this minimal one.
{{#if e2e.hasBody}}
    const response = await application.client.{{e2e.call}}('{{e2e.samplePath}}', {});
{{/if}}
{{#unless e2e.hasBody}}
    const response = await application.client.{{e2e.call}}('{{e2e.samplePath}}');
{{/unless}}

    expectStatus(response, {{e2e.status}});
  });

  // TODO(domain): replace each entry below by a test of what a client or another context observes: responses, then the integration events (`collectEvents(application.events, [...])` and `eventually(...)` for what happens after the answer). Never read the database.
  it.todo('lets a client observe the outcome of "{{name.words}}" through the API');
  it.todo('publishes the integration events other contexts rely on');
  it.todo('answers the documented problem for each business refusal');
});
