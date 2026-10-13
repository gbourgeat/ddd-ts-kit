/** What setting up the clients leaves for someone to do. */
export interface SdkSetUp {
  /** The directories of clients whose document the contract no longer has. */
  readonly gone: readonly string[];
  /** The directories of clients the npm lockfile does not link yet. */
  readonly unlocked: readonly string[];
}
