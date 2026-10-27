import { splitWords } from '../../naming';
import type { Glossary } from './parse-glossary';
import { sameWord } from './same-word';

/**
 * The positions of `words` that a term of the glossary holds: every word of a run of consecutive
 * words that says one whole term, inflected or not. `Scoring model` holds the first two words of
 * `ScoringModelVersioned`, and `Copy of data` the three words of `CopyOfData`.
 */
export function heldByGlossary(words: readonly string[], glossary: Glossary): ReadonlySet<number> {
  const terms = glossary.terms.map((term) => splitWords(term)).filter((term) => term.length > 0);

  return new Set(terms.flatMap((term) => positionsOf(term, words)));
}

/** The positions of every run of `words` that says `term`. */
function positionsOf(term: readonly string[], words: readonly string[]): number[] {
  const starts = words
    .map((_word, start) => start)
    .filter((start) => term.every((word, offset) => sameWord(word, words[start + offset] ?? '')));

  return starts.flatMap((start) => term.map((_word, offset) => start + offset));
}
