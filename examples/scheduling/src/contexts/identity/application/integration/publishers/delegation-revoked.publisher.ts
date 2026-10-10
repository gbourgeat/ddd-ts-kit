import { IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { DelegationRevoked } from '#src/contexts/identity/domain/events/delegation-revoked.event.js';
import { delegationRevokedV1 } from '#src/contexts/identity/published-language/delegation-revoked.v1.integration-event.js';

@DomainEventHandler(DelegationRevoked, { name: 'identity.delegation.revoked' }, [
  IntegrationEventPublisher,
  IdGenerator,
])
export class DelegationRevokedPublisher implements DomainEventHandler<DelegationRevoked> {
  constructor(
    private readonly publisher: IntegrationEventPublisher,
    private readonly ids: IdGenerator,
  ) {}

  async handle(event: DelegationRevoked): Promise<void> {
    const published = delegationRevokedV1.create(
      {
        delegationId: event.aggregateId,
        practiceId: event.facts.practiceId,
        practitionerId: event.facts.practitionerId,
        assistantId: event.facts.assistantId,
        cause: event.facts.cause,
      },
      { id: this.ids.next(), occurredAt: event.occurredAt },
    );

    await this.publisher.publish([published]);
  }
}
