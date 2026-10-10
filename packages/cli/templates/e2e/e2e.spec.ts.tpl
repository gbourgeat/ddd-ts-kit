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
{{#if e2e.traced}}
import { expectSpanTree, installTestTracing } from '@ddd-ts-kit/tracing/testing';
{{/if}}
import { startApplication, type RunningApplication } from '{{alias.test}}/e2e/support/start-application.js';
{{#if e2e.traced}}
import { storyOf } from '{{alias.test}}/e2e/support/story-of.js';
{{/if}}

describe('{{name.title}}, end to end', () => {
{{#if e2e.traced}}
  const tracing = installTestTracing();
{{/if}}
  let application: RunningApplication;

  beforeAll(async () => {
    application = await startApplication();
  });

  afterAll(async () => {
    await application.close();
{{#if e2e.traced}}
    tracing.uninstall();
{{/if}}
  });

  beforeEach(async () => {
    await application.reset();
  });
{{#if tests.vitest}}

  reportSeedOnFailure({ beforeEach, onTestFailed });
{{/if}}

{{#if e2e.protected}}
  it('answers 401 to a caller who presents no credential', async () => {
    const response = await application.client.{{e2e.call}}('{{e2e.samplePath}}'{{e2e.body}});

    expectStatus(response, 401);
  });

  it('answers 403 to an actor who does not hold the permission', async () => {
    const stranger = await application.as({ id: 'stranger' });

    const response = await stranger.{{e2e.call}}('{{e2e.samplePath}}'{{e2e.body}});

    expectStatus(response, 403);
  });

{{/if}}
{{#if e2e.traced}}
  it('is one trace: the request, the use case and what it saves', async () => {
{{#if e2e.protected}}
{{#if authz.rebac}}
    await application.relate({ object: 'context:{{context.kebab}}', relation: 'operator', subject: 'user:ada' });
{{/if}}
    const ada = await application.as({ id: 'ada', roles: ['admin'] });

    const trace = await tracing.traceOf(async () => {
      expectStatus(await ada.{{e2e.call}}('{{e2e.samplePath}}'{{e2e.body}}), {{e2e.status}});
    });
{{/if}}
{{#unless e2e.protected}}
    const trace = await tracing.traceOf(async () => {
      expectStatus(await application.client.{{e2e.call}}('{{e2e.samplePath}}'{{e2e.body}}), {{e2e.status}});
    });
{{/unless}}

    // Exact on names and structure, and kept before the tests whose request leaves work behind (a relay still publishing would add its spans here). Once "{{name.words}}" announces a fact, its spans come after the save, under `unit-of-work before-commit`: `domain-event <name>`, `handler <Class>`, `outbox append <type>`, then, awaited with `eventually`, `publish <type>` and `process <consumer>` with the command it sends.
    expectSpanTree(storyOf(trace), [
      {{e2e.tree}}
    ]);
  });

{{/if}}
  it('answers {{e2e.status}} to {{e2e.method}} {{e2e.path}}', async () => {
    // TODO(domain): arrange what "{{name.words}}" needs through the public API only (other routes), with the builders of test/builders and generated data; send a realistic request instead of this minimal one.
{{#if e2e.protected}}
{{#if authz.rebac}}
    await application.relate({ object: 'context:{{context.kebab}}', relation: 'operator', subject: 'user:ada' });
{{/if}}
    const ada = await application.as({ id: 'ada', roles: ['admin'] });

    const response = await ada.{{e2e.call}}('{{e2e.samplePath}}'{{e2e.body}});
{{/if}}
{{#unless e2e.protected}}
    const response = await application.client.{{e2e.call}}('{{e2e.samplePath}}'{{e2e.body}});
{{/unless}}

    expectStatus(response, {{e2e.status}});
  });

  // TODO(domain): replace each entry below by a test of what a client or another context observes: responses, then the integration events (`collectEvents(application.events, [...])` and `eventually(...)` for what happens after the answer). Never read the database.
  it.todo('lets a client observe the outcome of "{{name.words}}" through the API');
  it.todo('publishes the integration events other contexts rely on');
  it.todo('answers the documented problem for each business refusal');
});
