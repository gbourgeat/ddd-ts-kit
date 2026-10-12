import type { IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { PersonRegistered } from '@/contexts/identity/domain/events/person-registered.event';
import { personRegisteredV1 } from '@/contexts/identity/published-language/person-registered.v1.integration-event';

@DomainEventHandler(PersonRegistered, { name: 'identity.person.registered' })
export class PersonRegisteredPublisher implements DomainEventHandler<PersonRegistered> {
  constructor(
    private readonly publisher: IntegrationEventPublisher,
    private readonly ids: IdGenerator,
  ) {}

  async handle(event: PersonRegistered): Promise<void> {
    const published = personRegisteredV1.create(
      {
        personId: event.aggregateId,
        displayName: event.facts.displayName,
        email: event.facts.email,
      },
      { id: this.ids.next(), occurredAt: event.occurredAt },
    );

    await this.publisher.publish([published]);
  }
}
