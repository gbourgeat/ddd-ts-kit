import { ConceptError } from '../errors/concept-error.js';

/**
 * The refusal of a transition a state does not allow, when the declaration of the machine names
 * no refusal of its own: a business refusal of the concept error of the aggregate says more, and
 * replaces it as soon as the lifecycle is known.
 */
export class TransitionError extends ConceptError {
  static forbidden(from: string, transition: string) {
    return TransitionError.refusal(
      'FORBIDDEN_TRANSITION',
      `The transition "${transition}" is not allowed from the state "${from}".`,
      { from, transition },
    ).exposing('from', 'transition');
  }
}
