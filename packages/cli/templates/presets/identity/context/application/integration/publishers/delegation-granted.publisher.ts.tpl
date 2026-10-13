import type { IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { DelegationGranted } from '{{alias.context}}/domain/events/delegation-granted.event{{alias.ext}}';
import { delegationGrantedV1 } from '{{alias.context}}/published-language/delegation-granted.v1.integration-event{{alias.ext}}';

/** Tells the other contexts, through the outbox, in the transaction of the fact. */
@DomainEventHandler(DelegationGranted, { name: DelegationGranted.eventName })
export class DelegationGrantedPublisher implements DomainEventHandler<DelegationGranted> {
  constructor(
    private readonly publisher: IntegrationEventPublisher,
    private readonly ids: IdGenerator,
  ) {}

  async handle(event: DelegationGranted): Promise<void> {
    const published = delegationGrantedV1.create(
      {
        delegationId: event.aggregateId,
        organisationId: event.facts.organisationId,
        delegatorId: event.facts.delegatorId,
        delegateId: event.facts.delegateId,
        rights: [...event.facts.rights],
        startsAt: event.facts.startsAt.toISOString(),
        endsAt: event.facts.endsAt.toISOString(),
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
