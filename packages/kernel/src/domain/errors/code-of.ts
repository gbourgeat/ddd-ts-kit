import type { RefusalOf } from './refusal-of.js';

/** The closed vocabulary of an error class: the union of the codes its static factories set. */
export type CodeOf<C> = RefusalOf<C>['code'];
