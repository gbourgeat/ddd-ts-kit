import type { Config } from '../config';

/** The slice `verify-slice` closes: the project, its context, and the trunk its changes are measured from. */
export interface SliceToVerify {
  readonly root: string;
  readonly config: Config;
  readonly context: string;
  readonly since: string;
}
