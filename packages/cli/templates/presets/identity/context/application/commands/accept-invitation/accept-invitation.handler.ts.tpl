import type { Clock, IdGenerator } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { Member } from '{{alias.context}}/domain/aggregates/member.aggregate{{alias.ext}}';
import { AccountError } from '{{alias.context}}/domain/errors/account.error{{alias.ext}}';
import { InvitationError } from '{{alias.context}}/domain/errors/invitation.error{{alias.ext}}';
import { MemberError } from '{{alias.context}}/domain/errors/member.error{{alias.ext}}';
import type { AccountRepository } from '{{alias.context}}/domain/repositories/account.repository{{alias.ext}}';
import type { InvitationRepository } from '{{alias.context}}/domain/repositories/invitation.repository{{alias.ext}}';
import type { MemberRepository } from '{{alias.context}}/domain/repositories/member.repository{{alias.ext}}';
import { AcceptInvitationCommand } from '{{alias.context}}/application/commands/accept-invitation/accept-invitation.command{{alias.ext}}';
import type { InvitationTokens } from '{{alias.context}}/application/ports/invitation-tokens.port{{alias.ext}}';

@CommandHandler(AcceptInvitationCommand)
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
      throw InvitationError.notFound();
    }

    if (account === undefined) {
      throw AccountError.notFound(actor.id);
    }

    account.assertActive();

    const now = this.clock.now();
    const { organisationId, role } = invitation;

    invitation.accept(account, now);

    if ((await this.memberRepository.findOf(organisationId, account.id)) !== undefined) {
      throw MemberError.alreadyMember(organisationId, account.id);
    }

    await this.invitationRepository.save(invitation);

    await this.memberRepository.save(
      Member.join(this.ids.next(), { organisationId, accountId: account.id, role }, now),
    );

    return invitation.id;
  }
}
