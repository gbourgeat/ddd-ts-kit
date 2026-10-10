import type { Config } from '../config/index.js';
import type { Name } from '../naming/index.js';
import type { Workspace } from '../workspace/index.js';
import type { KindFlags } from './kind.js';

/** What every generator works with: the project, its stack and one bounded context. */
export interface Scope {
  readonly ws: Workspace;
  readonly config: Config;
  readonly context: Name;
  /** Directory of the context, relative to the project root. */
  readonly dir: string;
  readonly flags: KindFlags;
}
