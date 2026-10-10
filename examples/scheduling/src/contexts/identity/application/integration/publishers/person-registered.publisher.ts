import { IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { PersonRegistered } from '../../../domain/events/person-registered.event.js';
import { personRegisteredV1 } from '../../../published-language/person-registered.v1.integration-event.js';

@DomainEventHandler(PersonRegistered, { name: 'identity.person.registered' }, [IntegrationEventPublisher, IdGenerator])
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
