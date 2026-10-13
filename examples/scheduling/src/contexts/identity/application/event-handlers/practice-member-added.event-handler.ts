import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { PracticeMemberAdded } from '@/contexts/identity/domain/events/practice-member-added.event';
import type { IdentityRelationships } from '@/contexts/identity/application/ports/identity-relationships.port';

/** When a member is added, the platform learns their role in the practice and, for a practitioner, the desk they hold. */
@DomainEventHandler(PracticeMemberAdded, { name: PracticeMemberAdded.eventName })
export class PracticeMemberAddedEventHandler implements DomainEventHandler<PracticeMemberAdded> {
  constructor(private readonly relationships: IdentityRelationships) {}

  async handle(event: PracticeMemberAdded): Promise<void> {
    const { personId, role } = event.facts;

    await this.relationships.recordMembership({ practiceId: event.aggregateId, personId, role });
  }
}
