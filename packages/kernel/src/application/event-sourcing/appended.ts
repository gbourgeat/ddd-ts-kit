/** Where an append left its stream and the store. */
export interface Appended {
  /** The version of the stream after the append. */
  readonly version: number;
  /** The position of the last event appended; the position of the store when nothing was. */
  readonly position: number;
}
