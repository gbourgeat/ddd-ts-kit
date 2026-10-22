import type { Config } from '../config';
import type { Name } from '../naming';
import type { Workspace } from '../workspace';
import type { KindFlags } from './kind';

/** What every generator works with: the project, its stack and one bounded context. */
export interface Scope {
  readonly ws: Workspace;
  readonly config: Config;
  readonly context: Name;
  /** Directory of the context, relative to the project root. */
  readonly dir: string;
  readonly flags: KindFlags;
}
