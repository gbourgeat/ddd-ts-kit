import type { StoredData } from './stored-data';

/** The state of a stream at a version, kept to shorten its replay. A snapshot can always be thrown away. */
export interface StoredSnapshot {
  readonly stream: string;
  /** The number of events of the stream the state reflects. */
  readonly version: number;
  /** The version of the shape of `data`: a snapshot of another shape is ignored and the stream replayed. */
  readonly schemaVersion: number;
  readonly data: StoredData;
}
