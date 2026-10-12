import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { PracticeMemberRemoved } from '@/contexts/identity/domain/events/practice-member-removed.event';
import type { DelegationRepository } from '@/contexts/identity/domain/repositories/delegation.repository';
import type { IdentityRelationships } from '@/contexts/identity/application/ports/identity-relationships.port';

/**
 * When a member is removed, the platform forgets their role and their desk, and the delegations
 * they gave or received in that practice end with the membership.
 */
@DomainEventHandler(PracticeMemberRemoved, { name: 'identity.practice.member-removed' })
export class PracticeMemberRemovedEventHandler implements DomainEventHandler<PracticeMemberRemoved> {
  constructor(
    private readonly relationships: IdentityRelationships,
    private readonly delegationRepository: DelegationRepository,
  ) {}

  async handle(event: PracticeMemberRemoved): Promise<void> {
    const { personId, role } = event.facts;
    const orphaned = await this.delegationRepository.findActiveOfMember(event.aggregateId, personId);

    await this.relationships.forgetMembership({ practiceId: event.aggregateId, personId, role });

    for (const delegation of orphaned) {
      delegation.endWithMembership(event.occurredAt);

      await this.delegationRepository.save(delegation);
    }
  }
}
