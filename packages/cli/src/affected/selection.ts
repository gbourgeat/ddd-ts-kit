/** What a pull request has to run for a change set: the bounded contexts it reaches, and the ones it leaves to the default branch. */
export interface Selection {
  /** How much of the project the change set reaches: everything, some bounded contexts, or nothing that runs. */
  readonly scope: 'all' | 'contexts' | 'none';
  /** Why: the path that widened the selection to everything, or how the contexts were reached. */
  readonly reason: string;
  /** The contexts whose specs run and whose coverage is held, in the order of the config file; every context when the scope is `all`. */
  readonly contexts: readonly string[];
  /** The spec globs that run; what lives outside the contexts (platform, shared kernel, `test/`) runs with any of them. */
  readonly specs: readonly string[];
  /** The directories of the contexts left out, each ending in `/`: their specs are not run and their sources are not linted. */
  readonly leftOut: readonly string[];
}
