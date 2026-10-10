/**
 * What the platform must know of the people, the memberships and the delegations to decide a right
 * on a practice, a desk or a person. Recorded in the unit of work of the command that states the
 * fact; recording twice, or forgetting what is not there, changes nothing.
 */
export abstract class IdentityRelationships {
  abstract recordPerson(personId: string): Promise<void>;

  abstract recordMembership(membership: { readonly practiceId: string; readonly personId: string; readonly role: string }): Promise<void>;

  abstract forgetMembership(membership: { readonly practiceId: string; readonly personId: string; readonly role: string }): Promise<void>;

  abstract recordDelegation(delegation: {
    readonly practiceId: string;
    readonly practitionerId: string;
    readonly assistantId: string;
    readonly availabilityIncluded: boolean;
  }): Promise<void>;

  abstract forgetDelegation(delegation: { readonly practiceId: string; readonly practitionerId: string; readonly assistantId: string }): Promise<void>;
}
