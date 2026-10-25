import type { Clock } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
{{#unless style.declared}}
import type { CommandHandler } from '@ddd-ts-kit/kernel';
{{/unless}}
{{#unless refusals.named}}
import { AccountError } from '{{alias.context}}/domain/errors/account.error{{alias.ext}}';
import { InvitationError } from '{{alias.context}}/domain/errors/invitation.error{{alias.ext}}';
{{/unless}}
{{#if refusals.named}}
import { UnknownAccount } from '{{alias.context}}/domain/errors/unknown-account.error{{alias.ext}}';
import { UnknownInvitation } from '{{alias.context}}/domain/errors/unknown-invitation.error{{alias.ext}}';
{{/if}}
import type { AccountRepository } from '{{alias.context}}/domain/repositories/account.repository{{alias.ext}}';
import type { InvitationRepository } from '{{alias.context}}/domain/repositories/invitation.repository{{alias.ext}}';
{{#if style.declared}}
import { DeclineInvitationCommand } from '{{alias.context}}/application/commands/decline-invitation/decline-invitation.command{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import type { DeclineInvitationCommand } from '{{alias.context}}/application/commands/decline-invitation/decline-invitation.command{{alias.ext}}';
{{/unless}}
import type { InvitationTokens } from '{{alias.context}}/application/ports/invitation-tokens.port{{alias.ext}}';

{{#if style.declared}}
@CommandHandler(DeclineInvitationCommand)
{{/if}}
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

    invitation.decline(account, this.clock.now());
    await this.invitationRepository.save(invitation);

    return invitation.id;
  }
}
