import type { Config } from '../config/index.js';
import type { DeclaredFacts } from '../docs/declared-facts.js';
import type { Workspace } from '../workspace/index.js';

/** Where the facts of one context are read from. */
export interface ContextSources {
  readonly ws: Workspace;
  readonly config: Config;
  readonly name: string;
  /** Directory of the context, relative to the project root. */
  readonly directory: string;
  /** The text of the module file of an explicit context; empty in a declared one. */
  readonly module: string;
  /** What the decorators say, in a declared one. */
  readonly declarations?: DeclaredFacts;
}
