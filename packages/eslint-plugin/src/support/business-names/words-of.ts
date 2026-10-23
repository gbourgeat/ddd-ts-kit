import type { Config } from '../../project/config';
import { GENERIC_WORDS } from './generic-words';

/** The `words` and `allow` options of the rule, which come over `businessNames` of the config. */
export interface BusinessNameOptions {
  readonly words?: readonly string[];
  readonly allow?: readonly string[];
}

/** The words the rule reports: the list of the options, else of the config, else the defaults; less what either allows. */
export function wordsOf(config: Config, options: BusinessNameOptions): ReadonlySet<string> {
  const listed = options.words ?? config.businessNames.words ?? GENERIC_WORDS;
  const allowed = [...config.businessNames.allow, ...(options.allow ?? [])];

  return new Set(listed.filter((word) => !allowed.includes(word)));
}
