export interface JobOptions {
  /**
   * An occurrence that comes while the previous run is still in progress: `skip` (default) does
   * not start it, `queue` starts it when the run ends, one occurrence waiting at most.
   */
  readonly overlap?: 'skip' | 'queue';
  /**
   * Occurrences that passed without the scheduler reaching them in time (the process was down,
   * asleep or blocked): `skip` (default) waits for the next one, `run-once` runs the latest of
   * them, once, however many passed.
   */
  readonly missed?: 'skip' | 'run-once';
  /** Aborts a run that lasts longer, through its signal. Default: no limit. */
  readonly timeoutMs?: number;
  /** A random delay up to this many milliseconds before each run, so jobs do not all start on the minute. Default 0. */
  readonly jitterMs?: number;
  /** `false` never starts the job by time. Default `true`. Meant to be overridden from configuration. */
  readonly enabled?: boolean;
  /**
   * `true` (default): the scheduler takes the `Lock` of the occurrence, so that one instance of
   * an application running several runs it. Best effort: see the scheduler.
   */
  readonly singleInstance?: boolean;
  /**
   * `global` (default): one run per occurrence, in no tenant. `per-tenant`: one run per tenant
   * of the `TenantDirectory` for each occurrence, each in that tenant's execution scope, so the
   * job reads and writes one tenant at a time; one failing tenant does not stop the others.
   */
  readonly tenancy?: 'global' | 'per-tenant';
}
