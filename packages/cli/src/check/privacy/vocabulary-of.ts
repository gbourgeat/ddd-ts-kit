import type { Config } from '../../config';
import { PERSONAL_VOCABULARY } from './personal-vocabulary';
import { wordsOfName } from './words-of-name';

/** The vocabulary of the project: the words of the kit, then those of `privacy.vocabulary`, but those of `privacy.allow`. */
export function vocabularyOf(config: Config): string[] {
  const allowed = new Set(config.privacy.allow.map((word) => wordsOfName(word).join('_')));

  return [
    ...new Set([...PERSONAL_VOCABULARY, ...config.privacy.vocabulary.map((word) => wordsOfName(word).join('_'))]),
  ].filter((term) => !allowed.has(term));
}
