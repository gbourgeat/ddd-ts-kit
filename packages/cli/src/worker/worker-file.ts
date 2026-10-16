/**
 * What `.ddd-ts-kit/worker.json` holds in the worktree of a worker. A file written before the
 * kit recorded the rows, the base and the branch holds the context only.
 */
export interface WorkerFile {
  /** The one context the worker builds: what the guard of the plugin reads. */
  readonly context: string;
  /** The ids of the rows of the slices file it was briefed on, as written. */
  readonly rows?: readonly string[];
  /** The ref its worktree was cut from and is checked against. */
  readonly base?: string;
  readonly branch?: string;
}
