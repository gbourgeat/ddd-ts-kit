/** What the declaration or the binding of one adapter says of its policy, read as text. */
export interface AdapterPolicy {
  /** The port the adapter is bound to. */
  readonly port: string;
  readonly className: string;
  /** `external`, `gateway`, or whatever the declaration says; undefined when it says nothing. */
  readonly kind: string | undefined;
  /** Whether `ownPolicy(...)` is written: the default policy of the platform then leaves the adapter alone. */
  readonly ownPolicy: boolean;
  /** The durations of the `timeout(<number>)` written there, in milliseconds. */
  readonly timeouts: readonly number[];
  /** False when a `timeout(...)` is given anything but a number: its duration is known at run time only. */
  readonly readable: boolean;
}
