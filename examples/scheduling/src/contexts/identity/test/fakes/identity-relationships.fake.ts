import type { IdentityRelationships } from '../../application/ports/identity-relationships.port.js';

type Membership = Parameters<IdentityRelationships['recordMembership']>[0];
type Delegation = Parameters<IdentityRelationships['recordDelegation']>[0];

/** Keeps what is currently known, one line per relationship, so that a test reads the outcome and not the calls. */
export class FakeIdentityRelationships implements IdentityRelationships {
  private readonly known = new Set<string>();

  get current(): readonly string[] {
    return [...this.known].sort();
  }

  async recordPerson(personId: string): Promise<void> {
    this.known.add(`person ${personId}`);
  }

  async recordMembership(membership: Membership): Promise<void> {
    this.known.add(lineOfMembership(membership));
  }

  async forgetMembership(membership: Membership): Promise<void> {
    this.known.delete(lineOfMembership(membership));
  }

  async recordDelegation(delegation: Delegation): Promise<void> {
    this.known.add(lineOfDelegation(delegation) + (delegation.availabilityIncluded ? ' with availability' : ''));
  }

  async forgetDelegation(delegation: Omit<Delegation, 'availabilityIncluded'>): Promise<void> {
    this.known.delete(lineOfDelegation(delegation));
    this.known.delete(lineOfDelegation(delegation) + ' with availability');
  }
}

function lineOfMembership({ practiceId, personId, role }: Membership): string {
  return `${role} ${personId} of ${practiceId}`;
}

function lineOfDelegation({
  practiceId,
  practitionerId,
  assistantId,
}: Omit<Delegation, 'availabilityIncluded'>): string {
  return `delegate ${assistantId} of ${practitionerId} in ${practiceId}`;
}
