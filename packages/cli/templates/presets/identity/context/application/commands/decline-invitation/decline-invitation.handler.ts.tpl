import type { Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { AccountError } from '{{alias.context}}/domain/errors/account.error{{alias.ext}}';
import { InvitationError } from '{{alias.context}}/domain/errors/invitation.error{{alias.ext}}';
import type { AccountRepository } from '{{alias.context}}/domain/repositories/account.repository{{alias.ext}}';
import type { InvitationRepository } from '{{alias.context}}/domain/repositories/invitation.repository{{alias.ext}}';
import { DeclineInvitationCommand } from '{{alias.context}}/application/commands/decline-invitation/decline-invitation.command{{alias.ext}}';
import type { InvitationTokens } from '{{alias.context}}/application/ports/invitation-tokens.port{{alias.ext}}';

@CommandHandler(DeclineInvitationCommand)
export class DeclineInvitationHandler implements CommandHandler<DeclineInvitationCommand> {
  constructor(
    private readonly invitationRepository: InvitationRepository,
    private readonly accountRepository: AccountRepository,
    private readonly tokens: InvitationTokens,
    private readonly clock: Clock,
  ) {}

  async execute({ actor, token }: DeclineInvitationCommand): Promise<string> {
    const invitation = await this.invitationRepository.findByTokenHash(this.tokens.digestOf(token));
    const account = await this.accountRepository.findById(actor.id);

    if (invitation === undefined) {
      throw InvitationError.notFound();
    }

    if (account === undefined) {
      throw AccountError.notFound(actor.id);
    }

    invitation.decline(account, this.clock.now());
    await this.invitationRepository.save(invitation);

    return invitation.id;
  }
}
