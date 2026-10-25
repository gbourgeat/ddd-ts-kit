{{#if style.declared}}
import { IntegrationEventHandler } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
import { organisationOpenedV1, type OrganisationOpenedV1 } from '{{alias.context}}/published-language/organisation-opened.v1.integration-event{{alias.ext}}';
import type { IdentityProviderAdmin } from '{{alias.context}}/application/ports/identity-provider-admin.port{{alias.ext}}';

/**
 * The provider learns the organisation under its slug, so that its tokens can name it. Driven by
 * the fact the context published through its outbox, so delivered at least once: a provider that
 * fails is asked again until it answers, and asking twice changes nothing (the adapter is idempotent).
 */
{{#if style.declared}}
@IntegrationEventHandler(organisationOpenedV1, { consumer: '{{context.kebab}}.provider-opens-organisation' })
{{/if}}
export class OrganisationOpenedIntegrationHandler {
  static readonly eventType = organisationOpenedV1.type;

  constructor(private readonly identityProvider: IdentityProviderAdmin) {}

  async handle(event: OrganisationOpenedV1): Promise<void> {
    await this.identityProvider.openOrganisation({ id: event.payload.organisationId, name: event.payload.name });
  }
}
