import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { PersonRegistered } from '@/contexts/identity/domain/events/person-registered.event';
import { IdentityRelationships } from '@/contexts/identity/application/ports/identity-relationships.port';

/** When a person is registered, the platform learns that this person is themselves. */
@DomainEventHandler(PersonRegistered, { name: 'identity.person.registered' }, [IdentityRelationships])
export class PersonRegisteredEventHandler implements DomainEventHandler<PersonRegistered> {
  constructor(private readonly relationships: IdentityRelationships) {}

  async handle(event: PersonRegistered): Promise<void> {
    await this.relationships.recordPerson(event.aggregateId);
  }
}
