import { describe, expect, it } from '{{tests.module}}';
import { executeRoute } from '@ddd-ts-kit/http';
import { nestControllerRoute } from '@ddd-ts-kit/http/nest';
import { InMemoryQueryBus, pageOf, type Actor } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { SearchMembersQuery } from '{{alias.context}}/application/queries/search-members/search-members.query{{alias.ext}}';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';
import { SearchMembersController } from '{{alias.context}}/presentation/http/organisations/search-members/search-members.controller{{alias.ext}}';
import { {{context.camel}}Controllers } from '{{alias.context}}/{{context.kebab}}.controllers{{alias.ext}}';

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
    const asked: SearchMembersQuery[] = [];

    const queries = new InMemoryQueryBus().register(SearchMembersQuery, {
      execute: async (query) => {
        asked.push(query);

        return pageOf([ada], { total: 1 });
      },
    });

    const route = nestControllerRoute(SearchMembersController, {
      instanceOf: () => new SearchMembersController(queries),
      // A DTO without a decorated field accepts the empty object alone: whitelist and forbidNonWhitelisted refuse any field.
      schemaOfClass: (dto) => classSchema(dto, { validator: { forbidUnknownValues: false } }),
    });

    const response = await executeRoute(
      route,
      { params: { organisationId: 'acme' }, query: { limit: '10' }, headers: {}, body: {}, raw: undefined },
      { validateResponses: true, resolvePrincipal: () => caller },
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ items: [{ ...ada, joinedAt: '2026-01-01T00:00:00.000Z' }], total: 1 });
    expect(asked).toMatchObject([{ organisationId: 'acme', page: { kind: 'offset', limit: 10 } }]);
  });

  it('is listed in the Nest controllers of the context, which say what its signature takes and answers', () => {
    expect({{context.camel}}Controllers).toContain(SearchMembersController);
  });
});
