/** A process instance as a store keeps it. */
export interface StoredProcess {
  /** The `processName` of its class. */
  readonly name: string;
  /** The correlation key every event of the instance names: an appointment id, an order id. */
  readonly id: string;
  /** Plain JSON. */
  readonly state: unknown;
  /** Counted from 1 at the first save; what optimistic concurrency compares. */
  readonly version: number;
  readonly ended: boolean;
  /** The armed timeouts, by name: the id of the job that delivers each. */
  readonly timeouts: Readonly<Record<string, string>>;
}
