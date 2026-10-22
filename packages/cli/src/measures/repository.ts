import type { GitRunner } from '../story/attributed-marker';

/** The repository the measures read: its root, and the git that answers for it. */
export interface Repository {
  readonly root: string;
  readonly git: GitRunner;
}
