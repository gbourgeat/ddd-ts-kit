import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { OrganisationOpened } from '{{alias.context}}/domain/events/organisation-opened.event{{alias.ext}}';
import type { IdentityProviderAdmin } from '{{alias.context}}/application/ports/identity-provider-admin.port{{alias.ext}}';

/**
 * Once the organisation is committed, the provider knows it under its slug, so that its tokens can name it. After the commit, at most once: a failure is reported and never undoes the decision of
 * the context, which stays the reference; the provider is brought back in line by a new decision.
 */
@DomainEventHandler(OrganisationOpened, { name: OrganisationOpened.eventName, phase: 'after-commit' })
export class OrganisationOpenedEventHandler implements DomainEventHandler<OrganisationOpened> {
  constructor(private readonly identityProvider: IdentityProviderAdmin) {}

  async handle(event: OrganisationOpened): Promise<void> {
    await this.identityProvider.openOrganisation({ id: event.aggregateId, name: event.facts.name });
  }
}
