import type { DomainError } from '../errors/domain-error';

/** One transition of a state machine: the states it leaves, the state it reaches, and what may still refuse it. */
export interface TransitionDeclaration<State extends string, Context> {
  readonly from: readonly State[];
  /** Absent for a transition that keeps the state it leaves, such as moving an appointment to another slot. */
  readonly to?: State;
  /**
   * A rule of the business the state alone does not say: answers the refusal, from a static
   * factory of the concept error, or `undefined` to let the transition happen.
   */
  readonly guard?: (context: Context) => DomainError | undefined;
}
