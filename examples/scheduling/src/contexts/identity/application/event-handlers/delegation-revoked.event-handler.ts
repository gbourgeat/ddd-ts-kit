import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { DelegationRevoked } from '@/contexts/identity/domain/events/delegation-revoked.event';
import { IdentityRelationships } from '@/contexts/identity/application/ports/identity-relationships.port';

/** When a delegation ends, whatever the cause, the platform forgets that the assistant is a delegate on that desk. */
@DomainEventHandler(DelegationRevoked, { name: 'identity.delegation.revoked' }, [IdentityRelationships])
export class DelegationRevokedEventHandler implements DomainEventHandler<DelegationRevoked> {
  constructor(private readonly relationships: IdentityRelationships) {}

  async handle(event: DelegationRevoked): Promise<void> {
    const { practiceId, practitionerId, assistantId } = event.facts;

    await this.relationships.forgetDelegation({ practiceId, practitionerId, assistantId });
  }
}
