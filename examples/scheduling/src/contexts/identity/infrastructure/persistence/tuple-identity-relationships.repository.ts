import { RelationTupleStore, type RelationTuple } from '@ddd-ts-kit/auth/rebac';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { IdentityRelationships } from '@/contexts/identity/application/ports/identity-relationships.port';

type Membership = Parameters<IdentityRelationships['recordMembership']>[0];
type Delegation = Parameters<IdentityRelationships['forgetDelegation']>[0];

/**
 * Writes the relationships as tuples of the store the authorizer reads: a table of this database
 * (ADR-0001), written in the unit of work of the command. A relationship commits or rolls back
 * with the fact it follows, which is why its domain event handlers run before the commit.
 */
@Repository(IdentityRelationships)
export class TupleIdentityRelationships implements IdentityRelationships {
  constructor(private readonly tuples: RelationTupleStore) {}

  async recordPerson(personId: string): Promise<void> {
    await this.tuples.write([{ object: `person:${personId}`, relation: 'self', subject: userOf(personId) }]);
  }

  async recordMembership(membership: Membership): Promise<void> {
    await this.tuples.write(tuplesOfMembership(membership));
  }

  async forgetMembership(membership: Membership): Promise<void> {
    await this.tuples.delete(tuplesOfMembership(membership));
  }

  async recordDelegation(delegation: Delegation & { readonly availabilityIncluded: boolean }): Promise<void> {
    const [whole, availability] = tuplesOfDelegation(delegation);

    await this.tuples.write(delegation.availabilityIncluded ? [whole, availability] : [whole]);
  }

  async forgetDelegation(delegation: Delegation): Promise<void> {
    await this.tuples.delete(tuplesOfDelegation(delegation));
  }
}

/** The role in the practice and, for a practitioner, the desk they hold in it. */
function tuplesOfMembership({ practiceId, personId, role }: Membership): readonly RelationTuple[] {
  const practice = `practice:${practiceId}`;
  const member = { object: practice, relation: role, subject: userOf(personId) };

  if (role !== 'practitioner') {
    return [member];
  }

  const desk = deskOf(practiceId, personId);

  return [
    member,
    { object: desk, relation: 'holder', subject: userOf(personId) },
    { object: desk, relation: 'practice', subject: practice },
  ];
}

/** The delegation on the whole desk, then the one on its availabilities only. */
function tuplesOfDelegation({
  practiceId,
  practitionerId,
  assistantId,
}: Delegation): readonly [RelationTuple, RelationTuple] {
  const desk = deskOf(practiceId, practitionerId);

  return [
    { object: desk, relation: 'delegate', subject: userOf(assistantId) },
    { object: desk, relation: 'availability_delegate', subject: userOf(assistantId) },
  ];
}

function userOf(personId: string): string {
  return `user:${personId}`;
}

function deskOf(practiceId: string, practitionerId: string): string {
  return `desk:${practiceId}.${practitionerId}`;
}
