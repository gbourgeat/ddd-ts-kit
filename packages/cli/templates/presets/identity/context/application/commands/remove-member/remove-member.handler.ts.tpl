import type { Access } from '@ddd-ts-kit/auth';
import type { Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { MemberError } from '{{alias.context}}/domain/errors/member.error{{alias.ext}}';
import type { DelegationRepository } from '{{alias.context}}/domain/repositories/delegation.repository{{alias.ext}}';
import type { MemberRepository } from '{{alias.context}}/domain/repositories/member.repository{{alias.ext}}';
import { RoleRightsService } from '{{alias.context}}/domain/services/role-rights.service{{alias.ext}}';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';
import { {{context.camel}}Permissions } from '{{alias.context}}/application/authorization/{{context.kebab}}.permissions{{alias.ext}}';
import { RemoveMemberCommand } from '{{alias.context}}/application/commands/remove-member/remove-member.command{{alias.ext}}';

@CommandHandler(RemoveMemberCommand)
export class RemoveMemberHandler implements CommandHandler<RemoveMemberCommand> {
  constructor(
    private readonly memberRepository: MemberRepository,
    private readonly delegationRepository: DelegationRepository,
    private readonly access: Access,
    private readonly clock: Clock,
  ) {}

  /** Every delegation the member gave or received in the organisation ends with the membership. */
  async execute({ actor, organisationId, accountId }: RemoveMemberCommand): Promise<string> {
    const now = this.clock.now();
    const remover = await this.memberRepository.findOf(organisationId, actor.id);
    const lent = await this.delegationRepository.findUnendedTo(organisationId, actor.id);
    const rights = new RoleRightsService().rightsIn(organisationId, actor.id, { member: remover, lent, now });

    await this.access.authorize(actor, {{context.camel}}Permissions['member.remove'], rights);

    const member = await this.memberRepository.findOf(organisationId, accountId);

    if (member === undefined) {
      throw MemberError.notFound(organisationId, accountId);
    }

    const owners = await this.memberRepository.countOwners(organisationId);

    member.remove({ by: remover?.role ?? MemberRole.Member, owners }, now);
    await this.memberRepository.save(member);

    for (const delegation of await this.delegationRepository.findUnendedInvolving(organisationId, accountId)) {
      delegation.end(now);
      await this.delegationRepository.save(delegation);
    }

    return member.id;
  }
}
