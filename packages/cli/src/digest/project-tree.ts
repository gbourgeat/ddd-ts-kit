import type { Config } from '../config';
import type { ContextDescription } from '../describe/context-description';
import type { Workspace } from '../workspace';

/** The project as one commit holds it, written apart from the working tree, and what `describe` reads there. */
export interface ProjectTree {
  readonly ws: Workspace;
  /** Undefined when the commit holds no config the kit reads. */
  readonly config: Config | undefined;
  readonly contexts: readonly ContextDescription[];
  /** Why the contexts could not be read, when they could not. */
  readonly problem?: string;
}
