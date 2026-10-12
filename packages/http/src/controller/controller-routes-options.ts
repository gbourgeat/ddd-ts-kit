export interface ControllerRoutesOptions {
  /**
   * Builds what was given as a class, a controller or a guard: `resolve` of the application,
   * which injects each constructor parameter. Left out, only instances can be given.
   */
  readonly resolve?: <T>(target: abstract new (...args: never) => T) => T;
  /**
   * The security schemes of the application, as its contract names them: every route that is
   * not public documents them, unless one of its guards names its own. Default: `['bearer']`.
   */
  readonly security?: readonly string[];
  /**
   * `'skip'` leaves the guards out, for the spec of a controller alone: what it validates, what
   * it hands its use case, what it answers. The guards have specs of their own, and an
   * application never sets this.
   */
  readonly guards?: 'skip';
}
