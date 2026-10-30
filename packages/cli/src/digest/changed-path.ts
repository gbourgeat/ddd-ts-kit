import type { Change } from './digest';

/** A file the branch changes, relative to the project root, and how. */
export interface ChangedPath {
  readonly path: string;
  readonly change: Change;
}
