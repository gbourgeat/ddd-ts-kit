import type { Config } from '../config';
import type { ContextDescription } from '../describe/context-description';
import type { Workspace } from '../workspace';
import type { GrantSources } from './grant-sources';

/** The project as one commit holds it, written apart from the working tree, and what `describe` reads there. */
export interface ProjectTree {
  readonly ws: Workspace;
  /** Undefined when the commit holds no config the kit reads. */
  readonly config: Config | undefined;
  readonly contexts: readonly ContextDescription[];
  /** What grants the permissions by name, read once for the tree; none without a config. */
  readonly grants?: GrantSources;
  /** Why the contexts could not be read, when they could not. */
  readonly problem?: string;
}
