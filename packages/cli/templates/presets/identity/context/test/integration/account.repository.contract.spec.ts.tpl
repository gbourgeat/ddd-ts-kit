import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from '{{tests.module}}';
import { FixedClock, FixedExecutionScope, executionContext, type Actor } from '@ddd-ts-kit/kernel';
import { repositoryContract } from '@ddd-ts-kit/testing/contracts';
import type { Account } from '{{alias.context}}/domain/aggregates/account.aggregate{{alias.ext}}';
import { {{#if orm.knex}}Knex{{/if}}{{#if orm.drizzle}}Drizzle{{/if}}AccountRepository } from '{{alias.context}}/infrastructure/persistence/{{#if orm.knex}}knex{{/if}}{{#if orm.drizzle}}drizzle{{/if}}-account.repository{{alias.ext}}';
import { openTestDatabase, type TestDatabase } from '{{alias.platform}}/database/open-test-database{{alias.ext}}';
import { anAccount } from '{{alias.context}}/test/builders/account.builder{{alias.ext}}';
import { FakeAccountRepository } from '{{alias.context}}/test/fakes/account.repository.fake{{alias.ext}}';

const runner = { describe, it, expect, beforeEach, afterEach };
const clock = new FixedClock(new Date('2026-01-01T00:00:00.000Z'));
const actor: Actor = { id: 'subject-ada', type: 'user', roles: [], attributes: {} };
const scope = new FixedExecutionScope(executionContext({ correlationId: 'contract-spec', actor, origin: 'test' }));

const expectations = {
  createAggregate: () => anAccount().build(),
  mutate: (changed: Account) => {
    changed.deactivate(new Date('2026-02-01T00:00:00.000Z'));
  },
  idOf: (subject: Account) => subject.id,
  stateOf: (subject: Account) => subject.toState(),
};

let database: TestDatabase;

beforeAll(async () => {
  database = await openTestDatabase();
});

afterAll(async () => {
  await database.close();
});

repositoryContract<Account>(runner, {
  ...expectations,
  name: 'FakeAccountRepository',
  createRepository: () => new FakeAccountRepository(),
});

repositoryContract<Account>(runner, {
  ...expectations,
  name: '{{#if orm.knex}}Knex{{/if}}{{#if orm.drizzle}}Drizzle{{/if}}AccountRepository',
  createRepository: async () => {
    await database.reset();

    return new {{#if orm.knex}}Knex{{/if}}{{#if orm.drizzle}}Drizzle{{/if}}AccountRepository(database.persistence.database, scope, clock);
  },
});
