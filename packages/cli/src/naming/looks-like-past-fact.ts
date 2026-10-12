import { isPastWord } from './is-past-word.js';
import type { Name } from './name.js';

/** Pragmatic: one word of the fact has to look like a past participle. Not a grammar. */
export function looksLikePastFact(fact: Name): boolean {
  return fact.kebab.split('-').some(isPastWord);
}
