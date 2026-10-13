import type { DomainError } from '../errors/domain-error.js';
import type { ForbiddenTransition } from './forbidden-transition.js';
import type { TransitionDeclaration } from './transition-declaration.js';

/**
 * The lifecycle of an aggregate, written once: `defineStateMachine` reads it. Its states are the
 * values of the `status` field of the aggregate.
 */
export interface StateMachineDeclaration<State extends string, Name extends string, Context> {
  /** Every state, in the order a diagram shows them: the values of the closed vocabulary of the field. */
  readonly states: readonly State[];
  /** The states an aggregate may be created in. */
  readonly initial: readonly State[];
  /** Named after the intention methods of the aggregate: `confirm`, `cancel`. */
  readonly transitions: Readonly<Record<Name, TransitionDeclaration<State, Context>>>;
  /**
   * The refusal of a transition the current state does not allow, from a static factory of the
   * concept error, given the context the aggregate passed (its identifier, typically).
   */
  readonly refused: (forbidden: ForbiddenTransition<State, Name>, context: Context) => DomainError;
}
