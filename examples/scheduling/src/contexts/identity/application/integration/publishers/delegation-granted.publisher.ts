import { IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { DelegationGranted } from '@/contexts/identity/domain/events/delegation-granted.event.js';
import { delegationGrantedV1 } from '@/contexts/identity/published-language/delegation-granted.v1.integration-event.js';

@DomainEventHandler(DelegationGranted, { name: 'identity.delegation.granted' }, [
  IntegrationEventPublisher,
  IdGenerator,
])
export class DelegationGrantedPublisher implements DomainEventHandler<DelegationGranted> {
  constructor(
    private readonly publisher: IntegrationEventPublisher,
    private readonly ids: IdGenerator,
  ) {}

  async handle(event: DelegationGranted): Promise<void> {
    const published = delegationGrantedV1.create(
      {
        delegationId: event.aggregateId,
        practiceId: event.facts.practiceId,
        practitionerId: event.facts.practitionerId,
        assistantId: event.facts.assistantId,
        availabilityIncluded: event.facts.availabilityIncluded,
        ...(event.facts.endsAt === undefined ? {} : { endsAt: event.facts.endsAt.toISOString() }),
      },
      { id: this.ids.next(), occurredAt: event.occurredAt },
    );

    await this.publisher.publish([published]);
  }
}
