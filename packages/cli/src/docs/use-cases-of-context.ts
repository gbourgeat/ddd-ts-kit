import type { PolicyFact, RouteFact, UseCaseFact } from '../describe/context-description';

/** What `describe` knows of the use cases of a context, which the specs of its page are shared out under. */
export interface UseCasesOfContext {
  readonly useCases: readonly UseCaseFact[];
  readonly policies: readonly PolicyFact[];
  readonly routes: readonly RouteFact[];
}
