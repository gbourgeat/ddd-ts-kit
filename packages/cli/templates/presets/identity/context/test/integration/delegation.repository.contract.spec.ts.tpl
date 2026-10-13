import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from '{{tests.module}}';
import { FixedClock, FixedExecutionScope, executionContext, type Actor } from '@ddd-ts-kit/kernel';
import { repositoryContract } from '@ddd-ts-kit/testing/contracts';
import type { Delegation } from '{{alias.context}}/domain/aggregates/delegation.aggregate{{alias.ext}}';
import type { DelegationRepository } from '{{alias.context}}/domain/repositories/delegation.repository{{alias.ext}}';
import { {{#if orm.knex}}Knex{{/if}}{{#if orm.drizzle}}Drizzle{{/if}}DelegationRepository } from '{{alias.context}}/infrastructure/persistence/{{#if orm.knex}}knex{{/if}}{{#if orm.drizzle}}drizzle{{/if}}-delegation.repository{{alias.ext}}';
import { openTestDatabase, type TestDatabase } from '{{alias.platform}}/database/open-test-database{{alias.ext}}';
import { aDelegation } from '{{alias.context}}/test/builders/delegation.builder{{alias.ext}}';
import { FakeDelegationRepository } from '{{alias.context}}/test/fakes/delegation.repository.fake{{alias.ext}}';

const runner = { describe, it, expect, beforeEach, afterEach };
const clock = new FixedClock(new Date('2026-01-01T00:00:00.000Z'));
const actor: Actor = { id: 'subject-ada', type: 'user', roles: [], attributes: {} };
const scope = new FixedExecutionScope(executionContext({ correlationId: 'contract-spec', actor, origin: 'test' }));

const expectations = {
  createAggregate: () => aDelegation().build(),
  mutate: (changed: Delegation) => {
    changed.revoke(new Date('2026-01-02T00:00:00.000Z'));
  },
  idOf: (subject: Delegation) => subject.id,
  stateOf: (subject: Delegation) => subject.toState(),
};

let database: TestDatabase;

beforeAll(async () => {
  database = await openTestDatabase();
});

afterAll(async () => {
  await database.close();
});

repositoryContract<Delegation>(runner, {
  ...expectations,
  name: 'FakeDelegationRepository',
  createRepository: () => new FakeDelegationRepository(),
});

repositoryContract<Delegation>(runner, {
  ...expectations,
  name: '{{#if orm.knex}}Knex{{/if}}{{#if orm.drizzle}}Drizzle{{/if}}DelegationRepository',
  createRepository: async () => {
    await database.reset();

    return new {{#if orm.knex}}Knex{{/if}}{{#if orm.drizzle}}Drizzle{{/if}}DelegationRepository(database.persistence.database, scope, clock);
  },
});

describe.each(adapters())('%s, read by what a use case needs', (_name, create) => {
  it('finds the delegations not ended yet, lent to a member or involving them', async () => {
    const repository = await create();
    const revoked = aDelegation().identifiedBy('delegation-3').from('subject-ada').to('subject-grace').build();

    revoked.revoke(new Date('2026-01-02T00:00:00.000Z'));
    await repository.save(aDelegation().identifiedBy('delegation-1').from('subject-ada').to('subject-grace').build());
    await repository.save(aDelegation().identifiedBy('delegation-2').from('subject-grace').to('subject-alan').build());
    await repository.save(revoked);
    await repository.save(aDelegation().identifiedBy('delegation-4').in('globex').from('subject-ada').to('subject-grace').build());

    expect((await repository.findUnendedTo('acme', 'subject-grace')).map((found) => found.id)).toEqual(['delegation-1']);

    expect((await repository.findUnendedInvolving('acme', 'subject-grace')).map((found) => found.id).sort()).toEqual([
      'delegation-1',
      'delegation-2',
    ]);
  });
});

/** The fake and the adapter, each given as the use cases get it. */
function adapters(): [string, () => Promise<DelegationRepository>][] {
  return [
    ['FakeDelegationRepository', async () => new FakeDelegationRepository()],
    [
      '{{#if orm.knex}}Knex{{/if}}{{#if orm.drizzle}}Drizzle{{/if}}DelegationRepository',
      async () => {
        await database.reset();

        return new {{#if orm.knex}}Knex{{/if}}{{#if orm.drizzle}}Drizzle{{/if}}DelegationRepository(database.persistence.database, scope, clock);
      },
    ],
  ];
}
