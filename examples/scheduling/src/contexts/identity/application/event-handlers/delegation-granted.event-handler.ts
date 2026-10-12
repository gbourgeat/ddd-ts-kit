import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { DelegationGranted } from '@/contexts/identity/domain/events/delegation-granted.event';
import type { IdentityRelationships } from '@/contexts/identity/application/ports/identity-relationships.port';

/** When a delegation is granted, the platform learns that the assistant is a delegate on the desk of the practitioner. */
@DomainEventHandler(DelegationGranted, { name: 'identity.delegation.granted' })
export class DelegationGrantedEventHandler implements DomainEventHandler<DelegationGranted> {
  constructor(private readonly relationships: IdentityRelationships) {}

  async handle(event: DelegationGranted): Promise<void> {
    const { practiceId, practitionerId, assistantId, availabilityIncluded } = event.facts;

    await this.relationships.recordDelegation({ practiceId, practitionerId, assistantId, availabilityIncluded });
  }
}
