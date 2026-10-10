import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { PersonRegistered } from '../../domain/events/person-registered.event.js';
import { IdentityRelationships } from '../ports/identity-relationships.port.js';

/** When a person is registered, the platform learns that this person is themselves. */
@DomainEventHandler(PersonRegistered, { name: 'identity.person.registered' }, [IdentityRelationships])
export class PersonRegisteredEventHandler implements DomainEventHandler<PersonRegistered> {
  constructor(private readonly relationships: IdentityRelationships) {}

  async handle(event: PersonRegistered): Promise<void> {
    await this.relationships.recordPerson(event.aggregateId);
  }
}
