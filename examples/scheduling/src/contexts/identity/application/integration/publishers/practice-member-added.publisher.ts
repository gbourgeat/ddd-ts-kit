import type { IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { PracticeMemberAdded } from '@/contexts/identity/domain/events/practice-member-added.event';
import { practiceMemberAddedV1 } from '@/contexts/identity/published-language/practice-member-added.v1.integration-event';

@DomainEventHandler(PracticeMemberAdded)
export class PracticeMemberAddedPublisher implements DomainEventHandler<PracticeMemberAdded> {
  constructor(
    private readonly publisher: IntegrationEventPublisher,
    private readonly ids: IdGenerator,
  ) {}

  async handle(event: PracticeMemberAdded): Promise<void> {
    const published = practiceMemberAddedV1.create(
      {
        practiceId: event.aggregateId,
        personId: event.facts.personId,
        role: event.facts.role,
        displayName: event.facts.displayName,
        timeZone: event.facts.timeZone,
      },
      { id: this.ids.next(), occurredAt: event.occurredAt },
    );

    await this.publisher.publish([published]);
  }
}
