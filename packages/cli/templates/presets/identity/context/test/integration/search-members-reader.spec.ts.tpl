import { afterAll, beforeAll, beforeEach, describe, expect, it } from '{{tests.module}}';
import { FixedClock, FixedExecutionScope, executionContext, offsetPage, type Actor } from '@ddd-ts-kit/kernel';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';
import { {{#if orm.knex}}Knex{{/if}}{{#if orm.drizzle}}Drizzle{{/if}}AccountRepository } from '{{alias.context}}/infrastructure/persistence/{{#if orm.knex}}knex{{/if}}{{#if orm.drizzle}}drizzle{{/if}}-account.repository{{alias.ext}}';
import { {{#if orm.knex}}Knex{{/if}}{{#if orm.drizzle}}Drizzle{{/if}}MemberRepository } from '{{alias.context}}/infrastructure/persistence/{{#if orm.knex}}knex{{/if}}{{#if orm.drizzle}}drizzle{{/if}}-member.repository{{alias.ext}}';
import { {{#if orm.knex}}Knex{{/if}}{{#if orm.drizzle}}Drizzle{{/if}}SearchMembersReader } from '{{alias.context}}/infrastructure/persistence/{{#if orm.knex}}knex{{/if}}{{#if orm.drizzle}}drizzle{{/if}}-search-members-reader.repository{{alias.ext}}';
import { openTestDatabase, type TestDatabase } from '{{alias.platform}}/database/open-test-database{{alias.ext}}';
import { anAccount } from '{{alias.context}}/test/builders/account.builder{{alias.ext}}';
import { aMember } from '{{alias.context}}/test/builders/member.builder{{alias.ext}}';

const clock = new FixedClock(new Date('2026-01-01T00:00:00.000Z'));
const actor: Actor = { id: 'subject-ada', type: 'user', roles: [], attributes: {} };
const scope = new FixedExecutionScope(executionContext({ correlationId: 'reader-spec', actor, origin: 'test' }));

let database: TestDatabase;

beforeAll(async () => {
  database = await openTestDatabase();
});

beforeEach(async () => {
  await database.reset();

  const accounts = new {{#if orm.knex}}Knex{{/if}}{{#if orm.drizzle}}Drizzle{{/if}}AccountRepository(database.persistence.database, scope, clock);
  const members = new {{#if orm.knex}}Knex{{/if}}{{#if orm.drizzle}}Drizzle{{/if}}MemberRepository(database.persistence.database, scope, clock);

  for (const [id, name] of [
    ['subject-ada', 'Ada'],
    ['subject-grace', 'Grace'],
    ['subject-alan', 'Alan'],
  ] as const) {
    await accounts.save(anAccount().identifiedBy(id).named(name).reachedAt(`${id}@example.test`).build());
  }

  await members.save(aMember().identifiedBy('member-1').of('acme', 'subject-ada').as(MemberRole.Owner).joinedOn(joined(1)).build());
  await members.save(aMember().identifiedBy('member-2').of('acme', 'subject-grace').joinedOn(joined(2)).build());
  await members.save(aMember().identifiedBy('member-3').of('acme', 'subject-alan').joinedOn(joined(3)).removedAt(joined(4)).build());
  await members.save(aMember().identifiedBy('member-4').of('globex', 'subject-alan').joinedOn(joined(4)).build());
});

afterAll(async () => {
  await database.close();
});

describe('{{#if orm.knex}}Knex{{/if}}{{#if orm.drizzle}}Drizzle{{/if}}SearchMembersReader', () => {
  it('reads the current members of one organisation, with the profile of their account, earliest first', async () => {
    const reader = new {{#if orm.knex}}Knex{{/if}}{{#if orm.drizzle}}Drizzle{{/if}}SearchMembersReader(database.persistence.database);

    const page = await reader.search('acme', offsetPage({ limit: 10 }));

    expect(page).toEqual({
      items: [
        {
          memberId: 'member-1',
          accountId: 'subject-ada',
          displayName: 'Ada',
          email: 'subject-ada@example.test',
          role: MemberRole.Owner,
          joinedAt: joined(1),
        },
        {
          memberId: 'member-2',
          accountId: 'subject-grace',
          displayName: 'Grace',
          email: 'subject-grace@example.test',
          role: MemberRole.Member,
          joinedAt: joined(2),
        },
      ],
      total: 2,
    });
  });

  it('answers a page of them, latest first when asked, with the total', async () => {
    const reader = new {{#if orm.knex}}Knex{{/if}}{{#if orm.drizzle}}Drizzle{{/if}}SearchMembersReader(database.persistence.database);

    const page = await reader.search('acme', offsetPage({ limit: 1, offset: 1, sort: [{ field: 'joinedAt', direction: 'desc' }] }));

    expect(page.items.map((item) => item.memberId)).toEqual(['member-1']);
    expect(page.total).toBe(2);
  });
});

function joined(day: number): Date {
  return new Date(Date.UTC(2026, 0, day));
}
