import { AggregateRoot } from '@ddd-ts-kit/kernel';
import { DelegationEndsInThePast } from '@/contexts/identity/domain/errors/delegation-ends-in-the-past.error';
import { DelegationNotActive } from '@/contexts/identity/domain/errors/delegation-not-active.error';
import { DelegationGranted } from '@/contexts/identity/domain/events/delegation-granted.event';
import { DelegationRevoked } from '@/contexts/identity/domain/events/delegation-revoked.event';
import type { Desk } from '@/contexts/identity/domain/value-objects/desk.vo';
import { DelegationEndCause } from '@/contexts/identity/domain/vocabularies/delegation-end-cause.vocabulary';

/** Why a delegation ended: withdrawn by hand, its end date passed, or one of its two members left the practice. */
type EndCause = DelegationRevoked['facts']['cause'];

export interface DelegationState {
  readonly registeredAt: Date;
  readonly desk: Desk;
  readonly assistantId: string;
  readonly availabilityIncluded: boolean;
  readonly endsAt: Date | undefined;
  readonly ended: { readonly at: Date; readonly cause: EndCause } | undefined;
}

export class Delegation extends AggregateRoot<string> {
  private constructor(
    id: string,
    private state: DelegationState,
  ) {
    super(id);
  }

  static create(
    id: string,
    terms: Pick<DelegationState, 'desk' | 'assistantId' | 'availabilityIncluded' | 'endsAt'>,
    now: Date,
  ): Delegation {
    if (terms.endsAt !== undefined && terms.endsAt.getTime() <= now.getTime()) {
      throw DelegationEndsInThePast.atEnd(terms.endsAt);
    }

    const created = new Delegation(id, { ...terms, registeredAt: now, ended: undefined });

    created.record(
      new DelegationGranted(id, now, {
        practiceId: terms.desk.practiceId,
        practitionerId: terms.desk.practitionerId,
        assistantId: terms.assistantId,
        availabilityIncluded: terms.availabilityIncluded,
        endsAt: terms.endsAt,
      }),
    );

    return created;
  }

  static rehydrate(id: string, state: DelegationState): Delegation {
    return new Delegation(id, state);
  }

  /** Withdrawn by hand before its end: only an active delegation can be. */
  revoke(now: Date): void {
    if (!this.isActive) {
      throw DelegationNotActive.forDelegation(this.id);
    }

    this.end(DelegationEndCause.Revoked, now);
  }

  /** Ends once its end date is reached at the given instant; asked again, or too early, it changes nothing. */
  expire(at: Date): void {
    if (this.isActive && this.state.endsAt !== undefined && this.state.endsAt.getTime() <= at.getTime()) {
      this.end(DelegationEndCause.Expired, at);
    }
  }

  /** Ends because the practitioner or the assistant is no longer a member of the practice; already ended, it changes nothing. */
  endWithMembership(now: Date): void {
    if (this.isActive) {
      this.end(DelegationEndCause.MemberRemoved, now);
    }
  }

  isOn(desk: Desk): boolean {
    return this.state.desk.equals(desk);
  }

  get isActive(): boolean {
    return this.state.ended === undefined;
  }

  get registeredAt(): Date {
    return this.state.registeredAt;
  }

  get desk(): Desk {
    return this.state.desk;
  }

  get assistantId(): string {
    return this.state.assistantId;
  }

  toState(): DelegationState {
    return { ...this.state };
  }

  private end(cause: EndCause, at: Date): void {
    const { desk, assistantId } = this.state;

    this.state = { ...this.state, ended: { at, cause } };

    this.record(
      new DelegationRevoked(this.id, at, {
        practiceId: desk.practiceId,
        practitionerId: desk.practitionerId,
        assistantId,
        cause,
      }),
    );
  }
}
