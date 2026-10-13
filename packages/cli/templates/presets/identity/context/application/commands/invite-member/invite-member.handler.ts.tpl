import type { Access } from '@ddd-ts-kit/auth';
import type { Clock, IdGenerator } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { Invitation } from '{{alias.context}}/domain/aggregates/invitation.aggregate{{alias.ext}}';
import { Member } from '{{alias.context}}/domain/aggregates/member.aggregate{{alias.ext}}';
import type { DelegationRepository } from '{{alias.context}}/domain/repositories/delegation.repository{{alias.ext}}';
import type { InvitationRepository } from '{{alias.context}}/domain/repositories/invitation.repository{{alias.ext}}';
import type { MemberRepository } from '{{alias.context}}/domain/repositories/member.repository{{alias.ext}}';
import { RoleRightsService } from '{{alias.context}}/domain/services/role-rights.service{{alias.ext}}';
import { EmailAddress } from '{{alias.context}}/domain/value-objects/email-address.vo{{alias.ext}}';
import { MemberRight } from '{{alias.context}}/domain/vocabularies/member-right.vocabulary{{alias.ext}}';
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

  /**
   * Whoever may invite in the organisation invites, in their own role or below (never above it,
   * whatever a delegation lends them); the delegation used, if any, is named in the fact. The
   * token leaves in the answer, its digest stays.
   */
  async execute({ actor, organisationId, invitee }: InviteMemberCommand): Promise<{ id: string; token: string }> {
    const now = this.clock.now();
    const inviter = await this.memberRepository.findOf(organisationId, actor.id);
    const held = { member: inviter, lent: await this.delegationRepository.findUnendedTo(organisationId, actor.id), now };
    const rights = new RoleRightsService();

    await this.access.authorize(actor, {{context.camel}}Permissions['member.invite'], rights.rightsIn(organisationId, actor.id, held));

    Member.assertAppointable(organisationId, invitee.role, inviter?.role ?? MemberRole.Member);

    const { token, digest } = this.tokens.issue();
    const delegationId = rights.delegationUsedFor(MemberRight.InviteMembers, held);
    const terms = { organisationId, email: EmailAddress.create(invitee.email), role: invitee.role, tokenHash: digest, invitedBy: actor.id };
    const invitation = Invitation.issue(this.ids.next(), { ...terms, ...(delegationId === undefined ? {} : { delegationId }) }, now);

    await this.invitationRepository.save(invitation);

    return { id: invitation.id, token };
  }
}
