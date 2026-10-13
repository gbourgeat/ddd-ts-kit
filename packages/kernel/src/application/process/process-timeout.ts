/** A deadline of a process: at `at`, its timeout job runs the step of that name, unless disarmed or the process ended. */
export interface ProcessTimeout {
  readonly name: string;
  readonly at: Date;
}
