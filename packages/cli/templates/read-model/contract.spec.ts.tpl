{{#if adapter.needsDatabase}}
{{#if tenant.scoped}}
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from '{{tests.module}}';
import { FixedExecutionScope, executionContext, type Actor, type ExecutionContext } from '@ddd-ts-kit/kernel';
{{/if}}
{{#unless tenant.scoped}}
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from '{{tests.module}}';
{{/unless}}
{{/if}}
{{#unless adapter.needsDatabase}}
import { afterEach, beforeEach, describe, expect, it } from '{{tests.module}}';
{{/unless}}
import { readModelContract } from '@ddd-ts-kit/testing/contracts';
import type { {{name.pascal}}Row } from '{{alias.context}}/application/ports/{{name.kebab}}.port{{alias.ext}}';
import { {{adapter.pascal}} } from '{{alias.context}}/infrastructure/persistence/{{adapter.kebab}}{{alias.ext}}';
{{#if adapter.needsDatabase}}
import { openTestDatabase, type TestDatabase } from '{{alias.platform}}/database/open-test-database{{alias.ext}}';
{{/if}}
import { Fake{{name.pascal}} } from '{{alias.context}}/test/fakes/{{name.kebab}}.fake{{alias.ext}}';

const runner = { describe, it, expect, beforeEach, afterEach };

const expectations = {
  createRow: (key: string): {{name.pascal}}Row => ({
    id: key,
{{#if fields.any}}
{{fields.sample}}
{{/if}}
  }),
  // TODO(domain): add `change: (row: {{name.pascal}}Row) => ({ ...row, <a field>: <another value> })`, so that the suite proves a later event replaces what the row holds; the case stays pending until then.
};

readModelContract<{{name.pascal}}Row>(runner, {
  ...expectations,
  name: 'Fake{{name.pascal}}',
  createStore: () => new Fake{{name.pascal}}(),
});

{{#if adapter.needsDatabase}}
let database: TestDatabase;

beforeAll(async () => {
  database = await openTestDatabase();
});

afterAll(async () => {
  await database.close();
});

readModelContract<{{name.pascal}}Row>(runner, {
  ...expectations,
  name: '{{adapter.pascal}}',
  createStore: async () => {
    await database.reset();

{{#if tenant.scoped}}
    return new {{adapter.pascal}}(database.persistence.database, new FixedExecutionScope(workOf('acme')));
{{/if}}
{{#unless tenant.scoped}}
    return new {{adapter.pascal}}(database.persistence.database);
{{/unless}}
  },
});
{{#if tenant.scoped}}

describe('{{adapter.pascal}}, tenant by tenant', () => {
  it('hides from a tenant what another tenant wrote', async () => {
    await database.reset();

    const scope = new FixedExecutionScope(workOf('acme'));
    const store = new {{adapter.pascal}}(database.persistence.database, scope);
    const stamp = { eventId: 'event-1', occurredAt: new Date('2026-01-01T00:00:00.000Z') };

    await store.upsertIfNewer('row-1', stamp, () => expectations.createRow('row-1'));

    scope.enter(workOf('globex'));

    expect(await store.get('row-1')).toBeUndefined();
  });
});

function workOf(tenantId: string): ExecutionContext {
  const actor: Actor = { id: 'member-of-' + tenantId, type: 'user', tenantId, roles: [], attributes: {} };

  return executionContext({ correlationId: 'contract-spec', actor, origin: 'test' });
}
{{/if}}
{{/if}}
{{#unless adapter.needsDatabase}}
readModelContract<{{name.pascal}}Row>(runner, {
  ...expectations,
  name: '{{adapter.pascal}}',
  createStore: () => new {{adapter.pascal}}(),
});
{{/unless}}
