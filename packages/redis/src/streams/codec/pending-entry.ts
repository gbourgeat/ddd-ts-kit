/** One line of the pending entry list of a group. */
export interface PendingEntry {
  readonly id: string;
  readonly consumer: string;
  readonly deliveries: number;
}
