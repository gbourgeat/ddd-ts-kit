import type { Access } from '@ddd-ts-kit/auth';
import type { Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { MemberError } from '{{alias.context}}/domain/errors/member.error{{alias.ext}}';
import type { DelegationRepository } from '{{alias.context}}/domain/repositories/delegation.repository{{alias.ext}}';
import type { MemberRepository } from '{{alias.context}}/domain/repositories/member.repository{{alias.ext}}';
import { RoleRightsService } from '{{alias.context}}/domain/services/role-rights.service{{alias.ext}}';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';
import { {{context.camel}}Permissions } from '{{alias.context}}/application/authorization/{{context.kebab}}.permissions{{alias.ext}}';
import { ChangeMemberRoleCommand } from '{{alias.context}}/application/commands/change-member-role/change-member-role.command{{alias.ext}}';

@CommandHandler(ChangeMemberRoleCommand)
export class ChangeMemberRoleHandler implements CommandHandler<ChangeMemberRoleCommand> {
  constructor(
    private readonly memberRepository: MemberRepository,
    private readonly delegationRepository: DelegationRepository,
    private readonly access: Access,
    private readonly clock: Clock,
  ) {}

  /** The delegations the member gave end with the role they were granted under: what they lent may no longer be theirs. */
  async execute({ actor, organisationId, accountId, role }: ChangeMemberRoleCommand): Promise<string> {
    const now = this.clock.now();
    const changer = await this.memberRepository.findOf(organisationId, actor.id);
    const lent = await this.delegationRepository.findUnendedTo(organisationId, actor.id);
    const rights = new RoleRightsService().rightsIn(organisationId, actor.id, { member: changer, lent, now });

    await this.access.authorize(actor, {{context.camel}}Permissions['member.change-role'], rights);

    const member = await this.memberRepository.findOf(organisationId, accountId);

    if (member === undefined) {
      throw MemberError.notFound(organisationId, accountId);
    }

    const owners = await this.memberRepository.countOwners(organisationId);

    member.changeRole(role, { by: changer?.role ?? MemberRole.Member, owners }, now);
    await this.memberRepository.save(member);
    await this.endDelegationsGivenBy(member.organisationId, member.accountId, now);

    return member.id;
  }

  private async endDelegationsGivenBy(organisationId: string, accountId: string, now: Date): Promise<void> {
    const involving = await this.delegationRepository.findUnendedInvolving(organisationId, accountId);

    for (const delegation of involving.filter((given) => given.delegatorId === accountId)) {
      delegation.end(now);
      await this.delegationRepository.save(delegation);
    }
  }
}
