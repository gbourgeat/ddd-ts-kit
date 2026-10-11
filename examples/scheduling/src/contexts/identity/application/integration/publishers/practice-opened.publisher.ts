import { IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { PracticeOpened } from '@/contexts/identity/domain/events/practice-opened.event';
import { practiceOpenedV1 } from '@/contexts/identity/published-language/practice-opened.v1.integration-event';

@DomainEventHandler(PracticeOpened, { name: 'identity.practice.opened' }, [IntegrationEventPublisher, IdGenerator])
export class PracticeOpenedPublisher implements DomainEventHandler<PracticeOpened> {
  constructor(
    private readonly publisher: IntegrationEventPublisher,
    private readonly ids: IdGenerator,
  ) {}

  async handle(event: PracticeOpened): Promise<void> {
    const published = practiceOpenedV1.create(
      {
        practiceId: event.aggregateId,
        name: event.facts.name,
        timeZone: event.facts.timeZone,
        managerId: event.facts.managerId,
      },
      { id: this.ids.next(), occurredAt: event.occurredAt },
    );

    await this.publisher.publish([published]);
  }
}
