import type { Config } from '../../config/index.js';
import { GENERIC_WORDS } from './generic-words.js';

/** The words of the rule for a project: `businessNames.words` in place of the defaults, less `businessNames.allow`. */
export function genericWordsOf(config: Config): ReadonlySet<string> {
  const { words, allow } = config.businessNames;

  return new Set((words ?? GENERIC_WORDS).filter((word) => !allow.includes(word)));
}
