import type { Config } from '../config';

/** The slice `verify-slice` closes: the project, its context, and the trunk its changes are measured from. */
export interface SliceToVerify {
  readonly root: string;
  readonly config: Config;
  readonly context: string;
  /** The trunk by the name the caller gave, which the report prints. */
  readonly since: string;
  /** The commit it names, resolved once by the command: what git is given at every step. */
  readonly sinceCommit: string;
}
