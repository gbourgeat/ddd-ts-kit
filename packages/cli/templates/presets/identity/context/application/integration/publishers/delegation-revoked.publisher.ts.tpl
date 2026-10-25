import type { IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
{{#if style.declared}}
import { DelegationRevoked } from '{{alias.context}}/domain/events/delegation-revoked.event{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import type { DelegationRevoked } from '{{alias.context}}/domain/events/delegation-revoked.event{{alias.ext}}';
{{/unless}}
import { delegationRevokedV1 } from '{{alias.context}}/published-language/delegation-revoked.v1.integration-event{{alias.ext}}';

/** Tells the other contexts, through the outbox, in the transaction of the fact. */
{{#if style.declared}}
@DomainEventHandler(DelegationRevoked)
{{/if}}
export class DelegationRevokedPublisher{{#if style.declared}} implements DomainEventHandler<DelegationRevoked>{{/if}} {
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
