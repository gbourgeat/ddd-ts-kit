import { Repository } from '@ddd-ts-kit/kernel';
import type { Delegation } from '../aggregates/delegation.aggregate.js';
import type { Desk } from '../value-objects/desk.vo.js';

export abstract class DelegationRepository extends Repository<Delegation> {
  /** The delegation a practitioner currently gives this assistant on this desk: there is at most one. */
  abstract findActiveBetween(desk: Desk, assistantId: string): Promise<Delegation | undefined>;

  /** The active delegations a member of a practice gave as a practitioner or received as an assistant. */
  abstract findActiveOfMember(practiceId: string, personId: string): Promise<readonly Delegation[]>;

  /** The active delegations whose end date is reached at this instant. */
  abstract findDueAt(instant: Date): Promise<readonly Delegation[]>;
}
