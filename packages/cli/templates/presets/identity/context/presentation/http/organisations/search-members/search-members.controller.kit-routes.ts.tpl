{{#if validation.classValidator}}
import {
  Controller,
  pageQuerySchema,
  pageResponse,
  pageSchemaOf,
  type HttpRequest,
  type PageBody,
} from '@ddd-ts-kit/http';
import type { QueryBus } from '@ddd-ts-kit/kernel';
import type { Infer } from '@ddd-ts-kit/validation';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { SearchMembersQuery } from '{{alias.context}}/application/queries/search-members/search-members.query{{alias.ext}}';
import type { SearchMembersItem } from '{{alias.context}}/application/queries/search-members/search-members.result{{alias.ext}}';
import { SearchMembersLine } from '{{alias.context}}/presentation/http/organisations/search-members/search-members.line{{alias.ext}}';
import { SearchMembersParams } from '{{alias.context}}/presentation/http/organisations/search-members/search-members.params{{alias.ext}}';
import { OrganisationsRoutes } from '{{alias.context}}/presentation/http/organisations.routes{{alias.ext}}';

const params = classSchema(SearchMembersParams);
const query = pageQuerySchema({ sortable: ['joinedAt'], maxSize: 100, kind: 'offset' });
const line = classSchema(SearchMembersLine);
{{/if}}
{{#if validation.zod}}
import { z } from 'zod';
import {
  Controller,
  pageQuerySchema,
  pageResponse,
  pageSchemaOf,
  type HttpRequest,
  type PageBody,
} from '@ddd-ts-kit/http';
import type { QueryBus } from '@ddd-ts-kit/kernel';
import type { Infer } from '@ddd-ts-kit/validation';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { SearchMembersQuery } from '{{alias.context}}/application/queries/search-members/search-members.query{{alias.ext}}';
import type { SearchMembersItem } from '{{alias.context}}/application/queries/search-members/search-members.result{{alias.ext}}';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';
import { OrganisationsRoutes } from '{{alias.context}}/presentation/http/organisations.routes{{alias.ext}}';

const params = zodSchema(z.object({ organisationId: z.string().min(1) }));
const query = pageQuerySchema({ sortable: ['joinedAt'], maxSize: 100, kind: 'offset' });

const line = zodSchema(
  z.object({
    memberId: z.string(),
    accountId: z.string(),
    displayName: z.string(),
    email: z.string(),
    role: z.enum(MemberRole),
    joinedAt: z.iso.datetime(),
  }),
  { io: 'output' },
);

type SearchMembersLine = Infer<typeof line>;
{{/if}}

/** A page of the current members of an organisation, for its members. */
@Controller({
  group: OrganisationsRoutes,
  method: 'GET',
  path: '/:organisationId/members',
  summary: 'Search the members of an organisation',
  params,
  query,
  response: { status: 200, description: 'One page of the members.', body: pageSchemaOf(line) },
  errors: [],
})
export class SearchMembersController {
  constructor(private readonly queries: QueryBus) {}

  async handle(
    request: HttpRequest<{ params: Infer<typeof params>; query: Infer<typeof query> }>,
  ): Promise<PageBody<SearchMembersLine>> {
    const page = await this.queries.execute(
      new SearchMembersQuery(request.actor, request.params.organisationId, request.query),
    );

    return pageResponse(page, toLine);
  }
}

function toLine(member: SearchMembersItem): SearchMembersLine {
  return { ...member, joinedAt: member.joinedAt.toISOString() };
}
