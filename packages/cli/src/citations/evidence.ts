import type { Config } from '../config/index.js';
import type { History } from './history.js';
import type { NameIndex } from './name-index.js';

/** What a cited name is judged against. */
export interface Evidence {
  readonly root: string;
  readonly config: Config;
  /** The names and the files of the code: at the base ref, or in the working tree. */
  readonly index: NameIndex;
  readonly history: History;
  /** The ref the index was read at; undefined when it is the working tree, which judges removals only. */
  readonly ref?: string;
}
