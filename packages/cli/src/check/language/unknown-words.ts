import { splitWords } from '../../naming';
import type { Glossary } from './parse-glossary';
import { sameWord } from './same-word';

/** Words that name a role of the architecture, not a concept of the business. */
const STRUCTURAL_WORDS = new Set([
  'repository',
  'handler',
  'command',
  'query',
  'event',
  'error',
  'service',
  'id',
  'port',
  'publisher',
  'consumer',
  'builder',
]);

/** Link words of compound names such as MarkedAsPaid. */
const LINK_WORDS = new Set([
  'a',
  'an',
  'the',
  'as',
  'of',
  'by',
  'for',
  'to',
  'in',
  'on',
  'at',
  'and',
  'or',
  'with',
  'from',
  'per',
  'is',
  'not',
]);

/** The words of `name` that no term of the glossary covers, the `allowed` ones aside (the qualifiers of a refusal). */
export function unknownWords(name: string, glossary: Glossary, allowed: readonly string[] = []): string[] {
  const known = glossary.terms.flatMap((term) => splitWords(term));

  return splitWords(name).filter(
    (word) =>
      !STRUCTURAL_WORDS.has(word) &&
      !LINK_WORDS.has(word) &&
      !allowed.includes(word) &&
      !/^v?\d+$/.test(word) &&
      !known.some((term) => sameWord(term, word)),
  );
}
