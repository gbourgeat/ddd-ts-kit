/** One transition asked with `--transition "<name>:<from>[,<from>]...[><to>]"`, its states as values of the vocabulary. */
export interface RequestedTransition {
  /** The intention method of the aggregate that performs it, in camelCase. */
  readonly name: string;
  readonly from: readonly string[];
  /** Absent: the transition keeps the state it leaves. */
  readonly to?: string;
}
