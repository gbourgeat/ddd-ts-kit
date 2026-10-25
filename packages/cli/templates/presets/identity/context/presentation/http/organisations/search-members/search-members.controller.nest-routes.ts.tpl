import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { pageQuerySchema, pageResponse, pageSchemaOf, type PageBody } from '@ddd-ts-kit/http';
import { CurrentActor, KitRoute, KitRoutes } from '@ddd-ts-kit/http/nest';
import { QueryBus, type Actor } from '@ddd-ts-kit/kernel';
import type { Infer } from '@ddd-ts-kit/validation';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { SearchMembersQuery } from '{{alias.context}}/application/queries/search-members/search-members.query{{alias.ext}}';
import type { SearchMembersItem } from '{{alias.context}}/application/queries/search-members/search-members.result{{alias.ext}}';
import { SearchMembersLine } from '{{alias.context}}/presentation/http/organisations/search-members/search-members.line{{alias.ext}}';
import { SearchMembersParams } from '{{alias.context}}/presentation/http/organisations/search-members/search-members.params{{alias.ext}}';
import { OrganisationsRoutes } from '{{alias.context}}/presentation/http/organisations.routes{{alias.ext}}';

const query = pageQuerySchema({ sortable: ['joinedAt'], maxSize: 100, kind: 'offset' });
const line = classSchema(SearchMembersLine);

/** A page of the current members of an organisation, for its members: a page is no DTO class, so @KitRoute gives its query and its answer. */
@Controller()
@KitRoutes({ group: OrganisationsRoutes })
export class SearchMembersController {
  constructor(@Inject(QueryBus) private readonly queries: QueryBus) {}

  @Get(':organisationId/members')
  @KitRoute({
    summary: 'Search the members of an organisation',
    request: { query },
    response: { description: 'One page of the members.', body: pageSchemaOf(line) },
    errors: [],
  })
  async searchMembers(
    @Param() params: SearchMembersParams,
    @Query() criteria: Infer<typeof query>,
    @CurrentActor() actor: Actor,
  ): Promise<PageBody<SearchMembersLine>> {
    const page = await this.queries.execute(new SearchMembersQuery(actor, params.organisationId, criteria));

    return pageResponse(page, toLine);
  }
}

function toLine(member: SearchMembersItem): SearchMembersLine {
  return { ...member, joinedAt: member.joinedAt.toISOString() };
}
