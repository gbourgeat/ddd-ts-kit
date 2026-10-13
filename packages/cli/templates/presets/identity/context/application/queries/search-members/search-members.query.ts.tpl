import { AuthorizedQuery, type Actor, type PageRequest } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { {{context.camel}}Permissions } from '{{alias.context}}/application/authorization/{{context.kebab}}.permissions{{alias.ext}}';
import type {
  SearchMembersResult,
  SearchMembersSort,
} from '{{alias.context}}/application/queries/search-members/search-members.result{{alias.ext}}';

/** One page of the current members of an organisation, for its members. */
@Requires({{context.camel}}Permissions['member.search'], { resource: () => ({ type: 'context', id: '{{context.kebab}}' }) })
export class SearchMembersQuery extends AuthorizedQuery<SearchMembersResult> {
  constructor(
    actor: Actor,
    readonly organisationId: string,
    readonly page: PageRequest<SearchMembersSort>,
  ) {
    super(actor);
  }
}
