import { isPastFact } from './is-past-fact.js';
import type { Name } from './name.js';

/** Pragmatic: one word of the fact has to look like a past participle, and not like a command at its head. Not a grammar. */
export function looksLikePastFact(fact: Name): boolean {
  return isPastFact(fact.kebab.split('-'));
}
