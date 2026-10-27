import { splitWords } from '../../naming';
import { heldByGlossary } from './held-by-glossary';
import type { Glossary } from './parse-glossary';
import { TECHNICAL_WORDS } from './technical-words';

/**
 * The technical words of a name that no term of the glossary holds. The ubiquitous language wins:
 * `ScoringModel` carries no technical word once `Scoring model` is a term of the context, and
 * `PricingModel` still carries `model`. The generator and the rule language/no-technical-name
 * judge a name with this one function.
 */
export function technicalWordsOf(
  name: string,
  glossary: Glossary,
  technical: readonly string[] = TECHNICAL_WORDS,
): string[] {
  const words = splitWords(name);
  const held = heldByGlossary(words, glossary);

  return words.filter((word, index) => technical.includes(word) && !held.has(index));
}
