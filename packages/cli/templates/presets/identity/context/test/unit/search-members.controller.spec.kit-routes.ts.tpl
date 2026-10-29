import { describe, expect, it } from '{{tests.module}}';
import { routeOf } from '@ddd-ts-kit/http/testing';
import { pageOf, type Actor } from '@ddd-ts-kit/kernel';
import { RecordingQueryBus } from '@ddd-ts-kit/kernel/testing';
import { SearchMembersQuery } from '{{alias.context}}/application/queries/search-members/search-members.query{{alias.ext}}';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';
import { SearchMembersController } from '{{alias.context}}/presentation/http/organisations/search-members/search-members.controller{{alias.ext}}';

const caller: Actor = { id: 'subject-ada', type: 'user', roles: [], attributes: {} };

const ada = {
  memberId: 'member-1',
  accountId: 'subject-ada',
  displayName: 'Ada Lovelace',
  email: 'ada@example.test',
  role: MemberRole.Owner,
  joinedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('GET /organisations/:organisationId/members', () => {
  it('answers 200 with a page of the members, each instant written as ISO 8601', async () => {
    const queries = new RecordingQueryBus().answering(SearchMembersQuery, () => pageOf([ada], { total: 1 }));

    const { send } = routeOf(new SearchMembersController(queries), { caller });

    const response = await send({ params: { organisationId: 'acme' }, query: { limit: '10' } });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ items: [{ ...ada, joinedAt: '2026-01-01T00:00:00.000Z' }], total: 1 });
    expect(queries.executed).toMatchObject([{ organisationId: 'acme', page: { kind: 'offset', limit: 10 } }]);
  });
});
