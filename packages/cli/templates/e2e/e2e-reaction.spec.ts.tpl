import { randomUUID } from 'node:crypto';
{{#if tests.vitest}}
import { afterAll, beforeAll, beforeEach, describe, expect, it, onTestFailed } from 'vitest';
{{/if}}
{{#if tests.jest}}
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
{{/if}}
{{#unless upstream.known}}
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
{{/unless}}
{{#if tests.vitest}}
import { reportSeedOnFailure } from '@ddd-ts-kit/testing/faker';
{{/if}}
{{#if upstream.known}}
import { {{upstream.definition}} } from '{{alias.contexts}}/{{upstream.kebab}}/published-language/index{{alias.ext}}';
{{/if}}
import { startApplication, type RunningApplication } from '{{alias.test}}/e2e/support/start-application{{alias.ext}}';

// No route starts "{{name.words}}": {{e2e.handlers}} sends its command when {{upstream.kebab}} publishes {{upstream.eventName}}, so the spec publishes that event as {{upstream.kebab}} would.
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

  it('runs "{{name.words}}" when {{upstream.kebab}} publishes {{upstream.eventName}}', async () => {
    // TODO(domain): arrange what "{{name.words}}" needs through the public API only (routes), with the builders of test/builders and generated data; give the payload every field {{upstream.kebab}} declares, with the identifiers the arrangement created.
{{#if upstream.known}}
    const meta = { id: randomUUID(), occurredAt: new Date().toISOString() };
    const event = {{upstream.definition}}.create({ {{upstream.payloadKey}}: '{{upstream.payloadSample}}' }, meta);
{{/if}}
{{#unless upstream.known}}
    const event: IntegrationEvent = {
      id: randomUUID(),
      type: '{{upstream.eventName}}',
      version: {{upstream.version}},
      occurredAt: new Date().toISOString(),
      payload: { {{upstream.payloadKey}}: '{{upstream.payloadSample}}' },
    };
{{/unless}}

    await expect(application.publish([event])).resolves.toBeUndefined();
    await application.settled();
  });

{{#if e2e.readable}}
  // TODO(domain): replace each entry below by a test of what a client or another context observes once `await application.settled()` has resolved: the answers of {{e2e.reads}}, then the integration events (`collectEvents(application.events, [...])`); never a fixed delay, never the database.
  it.todo('lets a client observe the outcome of "{{name.words}}" through the API');
{{/if}}
{{#unless e2e.readable}}
  // TODO(domain): replace each entry below by a test of what another context observes once `await application.settled()` has resolved: the integration events "{{name.words}}" publishes (`collectEvents(application.events, [...])`), or the answer of a route that reads what it changed; never a fixed delay, never the database.
{{/unless}}
  it.todo('publishes the integration events other contexts rely on');
  it.todo('has the same outcome when {{upstream.eventName}} is delivered twice');
});
