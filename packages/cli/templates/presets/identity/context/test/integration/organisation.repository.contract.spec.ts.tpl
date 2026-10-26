import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from '{{tests.module}}';
import { FixedClock, FixedExecutionScope, executionContext, type Actor } from '@ddd-ts-kit/kernel';
import { repositoryContract } from '@ddd-ts-kit/testing/contracts';
import type { Organisation } from '{{alias.context}}/domain/aggregates/organisation.aggregate{{alias.ext}}';
import { {{#if orm.knex}}Knex{{/if}}{{#if orm.drizzle}}Drizzle{{/if}}{{#if orm.prisma}}Prisma{{/if}}OrganisationRepository } from '{{alias.context}}/infrastructure/persistence/{{#if orm.knex}}knex{{/if}}{{#if orm.drizzle}}drizzle{{/if}}{{#if orm.prisma}}prisma{{/if}}-organisation.repository{{alias.ext}}';
import { openTestDatabase, type TestDatabase } from '{{alias.platform}}/database/open-test-database{{alias.ext}}';
import { anOrganisation } from '{{alias.context}}/test/builders/organisation.builder{{alias.ext}}';
import { FakeOrganisationRepository } from '{{alias.context}}/test/fakes/organisation.repository.fake{{alias.ext}}';

const runner = { describe, it, expect, beforeEach, afterEach };
const clock = new FixedClock(new Date('2026-01-01T00:00:00.000Z'));
const actor: Actor = { id: 'subject-ada', type: 'user', roles: [], attributes: {} };
const scope = new FixedExecutionScope(executionContext({ correlationId: 'contract-spec', actor, origin: 'test' }));

const expectations = {
  createAggregate: () => anOrganisation().build(),
  // No `mutate`: nothing changes an organisation once opened, so the stale-save case stays pending.
  idOf: (subject: Organisation) => subject.id,
  stateOf: (subject: Organisation) => subject.toState(),
};

let database: TestDatabase;

beforeAll(async () => {
  database = await openTestDatabase();
});

afterAll(async () => {
  await database.close();
});

repositoryContract<Organisation>(runner, {
  ...expectations,
  name: 'FakeOrganisationRepository',
  createRepository: () => new FakeOrganisationRepository(),
});

repositoryContract<Organisation>(runner, {
  ...expectations,
  name: '{{#if orm.knex}}Knex{{/if}}{{#if orm.drizzle}}Drizzle{{/if}}{{#if orm.prisma}}Prisma{{/if}}OrganisationRepository',
  createRepository: async () => {
    await database.reset();

    return new {{#if orm.knex}}Knex{{/if}}{{#if orm.drizzle}}Drizzle{{/if}}{{#if orm.prisma}}Prisma{{/if}}OrganisationRepository(database.persistence.database, scope, clock);
  },
});
