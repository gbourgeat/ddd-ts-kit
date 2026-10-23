import type { Config } from '../../config';
import type { Flaw } from '../model/flaw';
import { strayEntry } from './stray-entry';

/**
 * Why the canonical tree refuses a path of a context (`src/contexts/<context>/...`): the flaw of
 * its first directory the tree refuses, from the outermost, then of the path itself; undefined
 * when the tree has a place for it.
 */
export function firstFlaw(cited: string, config: Config): Flaw | undefined {
  const segments = cited.replace(/\/$/, '').split('/');
  const directories = segments.slice(0, -1).map((_, index) => `${segments.slice(0, index + 1).join('/')}/`);

  for (const entry of [...directories, cited]) {
    const flaw = strayEntry(entry, config);

    if (flaw !== undefined) {
      return flaw;
    }
  }

  return undefined;
}
