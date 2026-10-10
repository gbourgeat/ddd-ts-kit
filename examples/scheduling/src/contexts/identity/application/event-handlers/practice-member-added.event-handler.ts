import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { PracticeMemberAdded } from '../../domain/events/practice-member-added.event.js';
import { IdentityRelationships } from '../ports/identity-relationships.port.js';

/** When a member is added, the platform learns their role in the practice and, for a practitioner, the desk they hold. */
@DomainEventHandler(PracticeMemberAdded, { name: 'identity.practice.member-added' }, [IdentityRelationships])
export class PracticeMemberAddedEventHandler implements DomainEventHandler<PracticeMemberAdded> {
  constructor(private readonly relationships: IdentityRelationships) {}

  async handle(event: PracticeMemberAdded): Promise<void> {
    const { personId, role } = event.facts;

    await this.relationships.recordMembership({ practiceId: event.aggregateId, personId, role });
  }
}
