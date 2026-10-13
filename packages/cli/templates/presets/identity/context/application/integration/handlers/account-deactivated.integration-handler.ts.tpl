import { IntegrationEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { accountDeactivatedV1, type AccountDeactivatedV1 } from '{{alias.context}}/published-language/account-deactivated.v1.integration-event{{alias.ext}}';
import type { IdentityProviderAdmin } from '{{alias.context}}/application/ports/identity-provider-admin.port{{alias.ext}}';

/**
 * The provider disables the person: they sign in no more. Delivered at least once through the
 * outbox, so a provider down at the time of the deactivation is asked again until it answers;
 * disabling twice changes nothing.
 */
@IntegrationEventHandler(accountDeactivatedV1, { consumer: '{{context.kebab}}.provider-disables-account' })
export class AccountDeactivatedIntegrationHandler {
  static readonly eventType = accountDeactivatedV1.type;

  constructor(private readonly identityProvider: IdentityProviderAdmin) {}

  async handle(event: AccountDeactivatedV1): Promise<void> {
    await this.identityProvider.disableAccount(event.payload.accountId);
  }
}
