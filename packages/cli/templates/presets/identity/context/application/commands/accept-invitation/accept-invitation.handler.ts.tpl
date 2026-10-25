import type { Clock, IdGenerator } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
{{#unless style.declared}}
import type { CommandHandler } from '@ddd-ts-kit/kernel';
{{/unless}}
import { Member } from '{{alias.context}}/domain/aggregates/member.aggregate{{alias.ext}}';
{{#unless refusals.named}}
import { AccountError } from '{{alias.context}}/domain/errors/account.error{{alias.ext}}';
import { InvitationError } from '{{alias.context}}/domain/errors/invitation.error{{alias.ext}}';
import { MemberError } from '{{alias.context}}/domain/errors/member.error{{alias.ext}}';
{{/unless}}
{{#if refusals.named}}
import { AlreadyMember } from '{{alias.context}}/domain/errors/already-member.error{{alias.ext}}';
import { UnknownAccount } from '{{alias.context}}/domain/errors/unknown-account.error{{alias.ext}}';
import { UnknownInvitation } from '{{alias.context}}/domain/errors/unknown-invitation.error{{alias.ext}}';
{{/if}}
import type { AccountRepository } from '{{alias.context}}/domain/repositories/account.repository{{alias.ext}}';
import type { InvitationRepository } from '{{alias.context}}/domain/repositories/invitation.repository{{alias.ext}}';
import type { MemberRepository } from '{{alias.context}}/domain/repositories/member.repository{{alias.ext}}';
{{#if style.declared}}
import { AcceptInvitationCommand } from '{{alias.context}}/application/commands/accept-invitation/accept-invitation.command{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import type { AcceptInvitationCommand } from '{{alias.context}}/application/commands/accept-invitation/accept-invitation.command{{alias.ext}}';
{{/unless}}
import type { InvitationTokens } from '{{alias.context}}/application/ports/invitation-tokens.port{{alias.ext}}';

{{#if style.declared}}
@CommandHandler(AcceptInvitationCommand)
{{/if}}
export class AcceptInvitationHandler implements CommandHandler<AcceptInvitationCommand> {
  constructor(
    private readonly invitationRepository: InvitationRepository,
    private readonly memberRepository: MemberRepository,
    private readonly accountRepository: AccountRepository,
    private readonly tokens: InvitationTokens,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  /** The person the invitation was sent to, signed in, answers with its token: they join in the role it names. */
  async execute({ actor, token }: AcceptInvitationCommand): Promise<string> {
    const invitation = await this.invitationRepository.findByTokenHash(this.tokens.digestOf(token));
    const account = await this.accountRepository.findById(actor.id);

    if (invitation === undefined) {
{{#if refusals.named}}
      throw UnknownInvitation.forReference();
{{/if}}
{{#unless refusals.named}}
      throw InvitationError.notFound();
{{/unless}}
    }

    if (account === undefined) {
{{#if refusals.named}}
      throw UnknownAccount.forAccount(actor.id);
{{/if}}
{{#unless refusals.named}}
      throw AccountError.notFound(actor.id);
{{/unless}}
    }

    account.assertActive();

    const now = this.clock.now();
    const { organisationId, role } = invitation;

    invitation.accept(account, now);

    if ((await this.memberRepository.findOf(organisationId, account.id)) !== undefined) {
{{#if refusals.named}}
      throw AlreadyMember.forMembership(organisationId, account.id);
{{/if}}
{{#unless refusals.named}}
      throw MemberError.alreadyMember(organisationId, account.id);
{{/unless}}
    }

    await this.invitationRepository.save(invitation);

    await this.memberRepository.save(
      Member.join(this.ids.next(), { organisationId, accountId: account.id, role }, now),
    );

    return invitation.id;
  }
}
