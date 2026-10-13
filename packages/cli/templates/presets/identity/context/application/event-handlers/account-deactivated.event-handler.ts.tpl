import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { AccountDeactivated } from '{{alias.context}}/domain/events/account-deactivated.event{{alias.ext}}';
import type { IdentityProviderAdmin } from '{{alias.context}}/application/ports/identity-provider-admin.port{{alias.ext}}';

/**
 * Once the deactivation is committed, the provider disables the person: they sign in no more. After the commit, at most once: a failure is reported and never undoes the decision of
 * the context, which stays the reference; the provider is brought back in line by a new decision.
 */
@DomainEventHandler(AccountDeactivated, { name: AccountDeactivated.eventName, phase: 'after-commit' })
export class AccountDeactivatedEventHandler implements DomainEventHandler<AccountDeactivated> {
  constructor(private readonly identityProvider: IdentityProviderAdmin) {}

  async handle(event: AccountDeactivated): Promise<void> {
    await this.identityProvider.disableAccount(event.aggregateId);
  }
}
