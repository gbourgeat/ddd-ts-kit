import type { Access } from '@ddd-ts-kit/auth';
import type { Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { InvitationError } from '{{alias.context}}/domain/errors/invitation.error{{alias.ext}}';
import type { DelegationRepository } from '{{alias.context}}/domain/repositories/delegation.repository{{alias.ext}}';
import type { InvitationRepository } from '{{alias.context}}/domain/repositories/invitation.repository{{alias.ext}}';
import type { MemberRepository } from '{{alias.context}}/domain/repositories/member.repository{{alias.ext}}';
import { RoleRightsService } from '{{alias.context}}/domain/services/role-rights.service{{alias.ext}}';
import { {{context.camel}}Permissions } from '{{alias.context}}/application/authorization/{{context.kebab}}.permissions{{alias.ext}}';
import { RevokeInvitationCommand } from '{{alias.context}}/application/commands/revoke-invitation/revoke-invitation.command{{alias.ext}}';

@CommandHandler(RevokeInvitationCommand)
export class RevokeInvitationHandler implements CommandHandler<RevokeInvitationCommand> {
  constructor(
    private readonly invitationRepository: InvitationRepository,
    private readonly memberRepository: MemberRepository,
    private readonly delegationRepository: DelegationRepository,
    private readonly access: Access,
    private readonly clock: Clock,
  ) {}

  /** Whoever may invite in the organisation takes back its invitations: an invitation of another organisation is not found here. */
  async execute({ actor, organisationId, invitationId }: RevokeInvitationCommand): Promise<string> {
    const now = this.clock.now();
    const member = await this.memberRepository.findOf(organisationId, actor.id);
    const lent = await this.delegationRepository.findUnendedTo(organisationId, actor.id);
    const rights = new RoleRightsService().rightsIn(organisationId, actor.id, { member, lent, now });

    await this.access.authorize(actor, {{context.camel}}Permissions['invitation.revoke'], rights);

    const invitation = await this.invitationRepository.findById(invitationId);

    if (invitation?.organisationId !== organisationId) {
      throw InvitationError.notFound();
    }

    invitation.revoke(now);
    await this.invitationRepository.save(invitation);

    return invitation.id;
  }
}
