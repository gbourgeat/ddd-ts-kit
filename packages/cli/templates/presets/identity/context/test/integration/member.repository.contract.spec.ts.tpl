import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from '{{tests.module}}';
import { FixedClock, FixedExecutionScope, executionContext, type Actor } from '@ddd-ts-kit/kernel';
import { repositoryContract } from '@ddd-ts-kit/testing/contracts';
import type { Member } from '{{alias.context}}/domain/aggregates/member.aggregate{{alias.ext}}';
import type { MemberRepository } from '{{alias.context}}/domain/repositories/member.repository{{alias.ext}}';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';
import { {{preset.adapter.pascal}}MemberRepository } from '{{alias.context}}/infrastructure/persistence/{{preset.adapter.kebab}}-member.repository{{alias.ext}}';
import { openTestDatabase, type TestDatabase } from '{{alias.platform}}/database/open-test-database{{alias.ext}}';
import { aMember } from '{{alias.context}}/test/builders/member.builder{{alias.ext}}';
import { FakeMemberRepository } from '{{alias.context}}/test/fakes/member.repository.fake{{alias.ext}}';

const runner = { describe, it, expect, beforeEach, afterEach };
const clock = new FixedClock(new Date('2026-01-01T00:00:00.000Z'));
const actor: Actor = { id: 'subject-ada', type: 'user', roles: [], attributes: {} };
const scope = new FixedExecutionScope(executionContext({ correlationId: 'contract-spec', actor, origin: 'test' }));

const expectations = {
  createAggregate: () => aMember().build(),
  mutate: (changed: Member) => {
    changed.changeRole(MemberRole.Admin, { by: MemberRole.Owner, byAccount: 'subject-owner', delegationId: undefined, owners: 2 }, new Date('2026-02-01T00:00:00.000Z'));
  },
  idOf: (subject: Member) => subject.id,
  stateOf: (subject: Member) => subject.toState(),
};

let database: TestDatabase;

beforeAll(async () => {
  database = await openTestDatabase();
});

afterAll(async () => {
  await database.close();
});

repositoryContract<Member>(runner, {
  ...expectations,
  name: 'FakeMemberRepository',
  createRepository: () => new FakeMemberRepository(),
});

repositoryContract<Member>(runner, {
  ...expectations,
  name: '{{preset.adapter.pascal}}MemberRepository',
  createRepository: async () => {
    await database.reset();

    return new {{preset.adapter.pascal}}MemberRepository(database.persistence.database, scope, clock);
  },
});

describe.each(adapters())('%s, read by what a use case needs', (_name, create) => {
  it('finds the current membership of an account in an organisation, and counts its owners', async () => {
    const repository = await create();

    await repository.save(aMember().of('acme', 'subject-ada').as(MemberRole.Owner).build());
    await repository.save(aMember().of('acme', 'subject-grace').as(MemberRole.Owner).removedAt(new Date('2026-02-01T00:00:00.000Z')).build());
    await repository.save(aMember().of('globex', 'subject-alan').as(MemberRole.Owner).build());

    expect((await repository.findOf('acme', 'subject-ada'))?.role).toBe(MemberRole.Owner);
    expect(await repository.findOf('acme', 'subject-grace')).toBeUndefined();
    expect(await repository.countOwners('acme')).toBe(1);
  });

  it('searches the current memberships of an account across organisations', async () => {
    const repository = await create();

    await repository.save(aMember().of('acme', 'subject-ada').build());
    await repository.save(aMember().of('globex', 'subject-ada').as(MemberRole.Admin).build());
    await repository.save(aMember().of('initech', 'subject-ada').removedAt(new Date('2026-02-01T00:00:00.000Z')).build());
    await repository.save(aMember().of('acme', 'subject-alan').build());

    const current = await repository.searchCurrentOf('subject-ada');

    expect(current.map((member) => member.organisationId).sort()).toEqual(['acme', 'globex']);
  });
});

/** The fake and the adapter, each given as the use cases get it. */
function adapters(): [string, () => Promise<MemberRepository>][] {
  return [
    ['FakeMemberRepository', async () => new FakeMemberRepository()],
    [
      '{{preset.adapter.pascal}}MemberRepository',
      async () => {
        await database.reset();

        return new {{preset.adapter.pascal}}MemberRepository(database.persistence.database, scope, clock);
      },
    ],
  ];
}
