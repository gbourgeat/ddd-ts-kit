import type { EventToAppend } from './event-to-append';
import type { StoredData } from './stored-data';

/** An event as the store gives it back, placed in its stream and in the whole store. */
export interface StoredEvent extends EventToAppend {
  readonly stream: string;
  /** Its rank in its stream, from 1: the stream reads in this order. */
  readonly version: number;
  /** Its rank in the store, from 1, in the order the appends committed: what a subscription remembers. */
  readonly position: number;
  readonly metadata: StoredData;
  /** The tenant of its stream, recorded at the first append by a store given an execution scope; absent otherwise. */
  readonly tenantId?: string;
}
