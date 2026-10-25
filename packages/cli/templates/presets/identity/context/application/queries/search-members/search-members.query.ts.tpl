import { AuthorizedQuery, type Actor, type PageRequest } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Requires } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
{{#if style.declared}}
import { {{context.camel}}Permissions } from '{{alias.context}}/{{context.kebab}}.permissions{{alias.ext}}';
{{/if}}
import type {
  SearchMembersResult,
  SearchMembersSort,
} from '{{alias.context}}/application/queries/search-members/search-members.result{{alias.ext}}';

/** One page of the current members of an organisation, for its members. */
{{#if style.declared}}
@Requires({{context.camel}}Permissions['member.search'], { resource: () => ({ type: 'context', id: '{{context.kebab}}' }) })
{{/if}}
export class SearchMembersQuery extends AuthorizedQuery<SearchMembersResult> {
  constructor(
    actor: Actor,
    readonly organisationId: string,
    readonly page: PageRequest<SearchMembersSort>,
  ) {
    super(actor);
  }
}
