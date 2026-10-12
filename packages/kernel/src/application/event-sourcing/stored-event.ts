import type { EventToAppend } from './event-to-append.js';
import type { StoredData } from './stored-data.js';

/** An event as the store gives it back, placed in its stream and in the whole store. */
export interface StoredEvent extends EventToAppend {
  readonly stream: string;
  /** Its rank in its stream, from 1: the stream reads in this order. */
  readonly version: number;
  /** Its rank in the store, from 1, in the order the appends committed: what a subscription remembers. */
  readonly position: number;
  readonly metadata: StoredData;
}
