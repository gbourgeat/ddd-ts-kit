import { IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { PracticeMemberRemoved } from '@/contexts/identity/domain/events/practice-member-removed.event';
import { practiceMemberRemovedV1 } from '@/contexts/identity/published-language/practice-member-removed.v1.integration-event';

@DomainEventHandler(PracticeMemberRemoved, { name: 'identity.practice.member-removed' }, [
  IntegrationEventPublisher,
  IdGenerator,
])
export class PracticeMemberRemovedPublisher implements DomainEventHandler<PracticeMemberRemoved> {
  constructor(
    private readonly publisher: IntegrationEventPublisher,
    private readonly ids: IdGenerator,
  ) {}

  async handle(event: PracticeMemberRemoved): Promise<void> {
    const published = practiceMemberRemovedV1.create(
      {
        practiceId: event.aggregateId,
        personId: event.facts.personId,
        role: event.facts.role,
      },
      { id: this.ids.next(), occurredAt: event.occurredAt },
    );

    await this.publisher.publish([published]);
  }
}
