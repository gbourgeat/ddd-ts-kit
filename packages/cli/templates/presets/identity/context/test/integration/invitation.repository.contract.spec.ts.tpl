import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from '{{tests.module}}';
import { FixedClock, FixedExecutionScope, executionContext, type Actor } from '@ddd-ts-kit/kernel';
import { repositoryContract } from '@ddd-ts-kit/testing/contracts';
import type { Invitation } from '{{alias.context}}/domain/aggregates/invitation.aggregate{{alias.ext}}';
import type { InvitationRepository } from '{{alias.context}}/domain/repositories/invitation.repository{{alias.ext}}';
import { {{#if orm.knex}}Knex{{/if}}{{#if orm.drizzle}}Drizzle{{/if}}InvitationRepository } from '{{alias.context}}/infrastructure/persistence/{{#if orm.knex}}knex{{/if}}{{#if orm.drizzle}}drizzle{{/if}}-invitation.repository{{alias.ext}}';
import { openTestDatabase, type TestDatabase } from '{{alias.platform}}/database/open-test-database{{alias.ext}}';
import { anInvitation } from '{{alias.context}}/test/builders/invitation.builder{{alias.ext}}';
import { FakeInvitationRepository } from '{{alias.context}}/test/fakes/invitation.repository.fake{{alias.ext}}';

const runner = { describe, it, expect, beforeEach, afterEach };
const clock = new FixedClock(new Date('2026-01-01T00:00:00.000Z'));
const actor: Actor = { id: 'subject-ada', type: 'user', roles: [], attributes: {} };
const scope = new FixedExecutionScope(executionContext({ correlationId: 'contract-spec', actor, origin: 'test' }));

const expectations = {
  createAggregate: () => anInvitation().build(),
  mutate: (changed: Invitation) => {
    changed.revoke(new Date('2026-02-01T00:00:00.000Z'));
  },
  idOf: (subject: Invitation) => subject.id,
  stateOf: (subject: Invitation) => subject.toState(),
};

let database: TestDatabase;

beforeAll(async () => {
  database = await openTestDatabase();
});

afterAll(async () => {
  await database.close();
});

repositoryContract<Invitation>(runner, {
  ...expectations,
  name: 'FakeInvitationRepository',
  createRepository: () => new FakeInvitationRepository(),
});

repositoryContract<Invitation>(runner, {
  ...expectations,
  name: '{{#if orm.knex}}Knex{{/if}}{{#if orm.drizzle}}Drizzle{{/if}}InvitationRepository',
  createRepository: async () => {
    await database.reset();

    return new {{#if orm.knex}}Knex{{/if}}{{#if orm.drizzle}}Drizzle{{/if}}InvitationRepository(database.persistence.database, scope, clock);
  },
});

describe.each(adapters())('%s, read by what a use case needs', (_name, create) => {
  it('finds an invitation by the digest of its token', async () => {
    const repository = await create();

    await repository.save(anInvitation().identifiedBy('invitation-1').withTokenHash('digest-1').build());
    await repository.save(anInvitation().identifiedBy('invitation-2').withTokenHash('digest-2').build());

    expect((await repository.findByTokenHash('digest-2'))?.id).toBe('invitation-2');
    expect(await repository.findByTokenHash('digest-9')).toBeUndefined();
  });
});

/** The fake and the adapter, each given as the use cases get it. */
function adapters(): [string, () => Promise<InvitationRepository>][] {
  return [
    ['FakeInvitationRepository', async () => new FakeInvitationRepository()],
    [
      '{{#if orm.knex}}Knex{{/if}}{{#if orm.drizzle}}Drizzle{{/if}}InvitationRepository',
      async () => {
        await database.reset();

        return new {{#if orm.knex}}Knex{{/if}}{{#if orm.drizzle}}Drizzle{{/if}}InvitationRepository(database.persistence.database, scope, clock);
      },
    ],
  ];
}
