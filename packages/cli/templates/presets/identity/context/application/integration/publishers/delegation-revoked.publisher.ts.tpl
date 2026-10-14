import type { IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { DelegationRevoked } from '{{alias.context}}/domain/events/delegation-revoked.event{{alias.ext}}';
import { delegationRevokedV1 } from '{{alias.context}}/published-language/delegation-revoked.v1.integration-event{{alias.ext}}';

/** Tells the other contexts, through the outbox, in the transaction of the fact. */
@DomainEventHandler(DelegationRevoked)
export class DelegationRevokedPublisher implements DomainEventHandler<DelegationRevoked> {
  constructor(
    private readonly publisher: IntegrationEventPublisher,
    private readonly ids: IdGenerator,
  ) {}

  async handle(event: DelegationRevoked): Promise<void> {
    const published = delegationRevokedV1.create(
      {
        delegationId: event.aggregateId,
        organisationId: event.facts.organisationId,
        delegatorId: event.facts.delegatorId,
        delegateId: event.facts.delegateId,
      },
      { id: this.ids.next(), occurredAt: event.occurredAt },
    );

{{#if tenancy.any}}
    // The organisation is the tenant of the fact: its consumers run in it, whoever acted.
    await this.publisher.publish([{ ...published, tenantId: event.facts.organisationId }]);
{{/if}}
{{#unless tenancy.any}}
    await this.publisher.publish([published]);
{{/unless}}
  }
}
