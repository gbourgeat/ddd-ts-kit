{{#if adapter.needsDatabase}}
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from '{{tests.module}}';
{{/if}}
{{#unless adapter.needsDatabase}}
import { afterEach, beforeEach, describe, expect, it } from '{{tests.module}}';
{{/unless}}
{{#if adapter.needsDatabase}}
import { FixedClock, FixedExecutionScope, executionContext, type Actor, type ExecutionContext } from '@ddd-ts-kit/kernel';
{{/if}}
import { repositoryContract } from '@ddd-ts-kit/testing/contracts';
import type { {{aggregate.pascal}} } from '../../domain/aggregates/{{aggregate.kebab}}.aggregate.js';
import { {{adapter.pascal}}{{aggregate.pascal}}Repository } from '../../infrastructure/persistence/{{adapter.kebab}}-{{aggregate.kebab}}.repository.js';
{{#if adapter.needsDatabase}}
import { openTestDatabase, type TestDatabase } from '{{paths.integrationToPlatform}}/database/testing.js';
{{/if}}
import { {{aggregate.article}}{{aggregate.pascal}} } from '../builders/{{aggregate.kebab}}.builder.js';
import { Fake{{aggregate.pascal}}Repository } from '../fakes/{{aggregate.kebab}}.repository.fake.js';

const runner = { describe, it, expect, beforeEach, afterEach };

const expectations = {
  createAggregate: () => {{aggregate.article}}{{aggregate.pascal}}().build(),
  mutate: (changed: {{aggregate.pascal}}) => {
    // TODO(domain): call a business method of {{aggregate.pascal}} on `changed` that alters its state, so that the suite proves an update is really stored.
  },
  idOf: (subject: {{aggregate.pascal}}) => subject.id,
  stateOf: (subject: {{aggregate.pascal}}) => subject.toState(),
};

repositoryContract<{{aggregate.pascal}}>(runner, {
  ...expectations,
  name: 'Fake{{aggregate.pascal}}Repository',
  createRepository: () => new Fake{{aggregate.pascal}}Repository(),
});

{{#if adapter.needsDatabase}}
const clock = new FixedClock(new Date('2026-01-01T00:00:00.000Z'));
let database: TestDatabase;

beforeAll(async () => {
  database = await openTestDatabase();
});

afterAll(async () => {
  await database.close();
});

repositoryContract<{{aggregate.pascal}}>(runner, {
  ...expectations,
  name: '{{adapter.pascal}}{{aggregate.pascal}}Repository',
  createRepository: async () => {
    await database.reset();
    return new {{adapter.pascal}}{{aggregate.pascal}}Repository(database.persistence.database, new FixedExecutionScope(workOf('acme')), clock);
  },
});
{{#if tenant.scoped}}

describe('{{adapter.pascal}}{{aggregate.pascal}}Repository, tenant by tenant', () => {
  it('hides from a tenant what another tenant saved', async () => {
    await database.reset();
    const scope = new FixedExecutionScope(workOf('acme'));
    const repository = new {{adapter.pascal}}{{aggregate.pascal}}Repository(database.persistence.database, scope, clock);
    const saved = {{aggregate.article}}{{aggregate.pascal}}().build();
    await repository.save(saved);

    scope.enter(workOf('globex'));

    expect(await repository.findById(saved.id)).toBeUndefined();
  });
});
{{/if}}

function workOf(tenantId: string): ExecutionContext {
  const actor: Actor = { id: 'member-of-' + tenantId, type: 'user', tenantId, roles: [], attributes: {} };
  return executionContext({ correlationId: 'contract-spec', actor, origin: 'test' });
}
{{/if}}
{{#unless adapter.needsDatabase}}
repositoryContract<{{aggregate.pascal}}>(runner, {
  ...expectations,
  name: '{{adapter.pascal}}{{aggregate.pascal}}Repository',
  createRepository: () => new {{adapter.pascal}}{{aggregate.pascal}}Repository(),
});
{{/unless}}
