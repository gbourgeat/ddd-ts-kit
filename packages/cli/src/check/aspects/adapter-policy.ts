import type { SourceFile } from '../model/source-file';

/** What the declaration or the binding of one adapter says of its policy, read as text. */
export interface AdapterPolicy {
  /** The port the adapter is bound to. */
  readonly port: string;
  readonly className: string;
  /** The file that states it: the one of the class in the declared style, the one that binds it otherwise. */
  readonly source: SourceFile;
  /** `external`, `gateway`, or whatever is stated; undefined when the adapter has no kind, or one the text does not show. */
  readonly kind: string | undefined;
  /** Whether `ownPolicy(...)` is written: the default policy of the platform then leaves the adapter alone. */
  readonly ownPolicy: boolean;
  /** The durations of the `timeout(<number>)` written there, in milliseconds. */
  readonly timeouts: readonly number[];
  /**
   * False when the limits around the adapter are known at run time only: a `timeout(...)` given
   * anything but a number, an aspect under `when(...)`, which goes around some calls only, or a
   * kind that is not a literal while no `ownPolicy(` keeps the default policy away.
   */
  readonly readable: boolean;
}
