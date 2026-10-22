import type { RefusalFacts } from './refusal-facts';

/** What a factory of a concept's error class answers: that error, its code and its facts known to the compiler. */
export type Refusal<E, Code extends string = string, Facts extends RefusalFacts = RefusalFacts> = E & {
  readonly code: Code;
  readonly facts: Facts;
};
