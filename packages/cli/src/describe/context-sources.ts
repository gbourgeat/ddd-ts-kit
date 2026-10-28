import type { Config } from '../config';
import type { DeclaredFacts } from '../docs/declared-facts';
import type { Workspace } from '../workspace';

/** Where the facts of one context are read from. */
export interface ContextSources {
  readonly ws: Workspace;
  readonly config: Config;
  readonly name: string;
  /** Directory of the context, relative to the project root. */
  readonly directory: string;
  /** The modules of the model it declares. */
  readonly modules: readonly string[];
  /** The text of the module files of an explicit context, its own and those of the modules of its model; empty in a declared one. */
  readonly module: string;
  /** What the decorators say, in a declared one. */
  readonly declarations?: DeclaredFacts;
}
