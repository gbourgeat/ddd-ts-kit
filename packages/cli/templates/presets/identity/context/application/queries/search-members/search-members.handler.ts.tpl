import type { Access } from '@ddd-ts-kit/auth';
import type { Clock } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { QueryHandler } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
{{#unless style.declared}}
import type { QueryHandler } from '@ddd-ts-kit/kernel';
{{/unless}}
import type { DelegationRepository } from '{{alias.context}}/domain/repositories/delegation.repository{{alias.ext}}';
import type { MemberRepository } from '{{alias.context}}/domain/repositories/member.repository{{alias.ext}}';
import { RoleRightsService } from '{{alias.context}}/domain/services/role-rights.service{{alias.ext}}';
import { {{context.camel}}Permissions } from '{{alias.context}}/{{context.kebab}}.permissions{{alias.ext}}';
import type { SearchMembersReader } from '{{alias.context}}/application/ports/search-members-reader.port{{alias.ext}}';
{{#if style.declared}}
import { SearchMembersQuery } from '{{alias.context}}/application/queries/search-members/search-members.query{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import type { SearchMembersQuery } from '{{alias.context}}/application/queries/search-members/search-members.query{{alias.ext}}';
{{/unless}}
import type { SearchMembersResult } from '{{alias.context}}/application/queries/search-members/search-members.result{{alias.ext}}';

{{#if style.declared}}
@QueryHandler(SearchMembersQuery)
{{/if}}
export class SearchMembersHandler implements QueryHandler<SearchMembersQuery> {
  constructor(
    private readonly reader: SearchMembersReader,
    private readonly memberRepository: MemberRepository,
    private readonly delegationRepository: DelegationRepository,
    private readonly access: Access,
    private readonly clock: Clock,
  ) {}

  /** The members of an organisation are read by its members, and by nobody else: the read names the organisation the right was decided on. */
  async execute({ actor, organisationId, page }: SearchMembersQuery): Promise<SearchMembersResult> {
    const now = this.clock.now();
    const member = await this.memberRepository.findOf(organisationId, actor.id);
    const lent = await this.delegationRepository.findUnendedTo(organisationId, actor.id);
    const rights = new RoleRightsService().rightsIn(organisationId, actor.id, { member, lent, now });

    await this.access.authorize(actor, {{context.camel}}Permissions['member.search'], rights);

    return this.reader.search(organisationId, page);
  }
}
