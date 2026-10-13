import type { Access } from '@ddd-ts-kit/auth';
import type { Clock, IdGenerator } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { Invitation } from '{{alias.context}}/domain/aggregates/invitation.aggregate{{alias.ext}}';
import { MemberError } from '{{alias.context}}/domain/errors/member.error{{alias.ext}}';
import type { DelegationRepository } from '{{alias.context}}/domain/repositories/delegation.repository{{alias.ext}}';
import type { InvitationRepository } from '{{alias.context}}/domain/repositories/invitation.repository{{alias.ext}}';
import type { MemberRepository } from '{{alias.context}}/domain/repositories/member.repository{{alias.ext}}';
import { RoleRightsService } from '{{alias.context}}/domain/services/role-rights.service{{alias.ext}}';
import { EmailAddress } from '{{alias.context}}/domain/value-objects/email-address.vo{{alias.ext}}';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';
import { {{context.camel}}Permissions } from '{{alias.context}}/application/authorization/{{context.kebab}}.permissions{{alias.ext}}';
import { InviteMemberCommand } from '{{alias.context}}/application/commands/invite-member/invite-member.command{{alias.ext}}';
import type { InvitationTokens } from '{{alias.context}}/application/ports/invitation-tokens.port{{alias.ext}}';

@CommandHandler(InviteMemberCommand)
export class InviteMemberHandler implements CommandHandler<InviteMemberCommand> {
  constructor(
    private readonly invitationRepository: InvitationRepository,
    private readonly memberRepository: MemberRepository,
    private readonly delegationRepository: DelegationRepository,
    private readonly tokens: InvitationTokens,
    private readonly access: Access,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  /** Whoever may invite in the organisation invites; only an owner invites an owner. The token leaves in the answer, its digest stays. */
  async execute({ actor, organisationId, invitee }: InviteMemberCommand): Promise<{ id: string; token: string }> {
    const now = this.clock.now();
    const inviter = await this.memberRepository.findOf(organisationId, actor.id);
    const lent = await this.delegationRepository.findUnendedTo(organisationId, actor.id);
    const rights = new RoleRightsService().rightsIn(organisationId, actor.id, { member: inviter, lent, now });

    await this.access.authorize(actor, {{context.camel}}Permissions['member.invite'], rights);

    if (invitee.role === MemberRole.Owner && inviter?.role !== MemberRole.Owner) {
      throw MemberError.ownersOnly(organisationId);
    }

    const { token, digest } = this.tokens.issue();
    const terms = { organisationId, email: EmailAddress.create(invitee.email), role: invitee.role };
    const invitation = Invitation.issue(this.ids.next(), { ...terms, tokenHash: digest, invitedBy: actor.id }, now);

    await this.invitationRepository.save(invitation);

    return { id: invitation.id, token };
  }
}
