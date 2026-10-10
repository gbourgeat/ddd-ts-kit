import type { Entry } from './codec/entry.js';

/** One entry handed to this process, with the number of times the group delivered it. */
export interface Delivery {
  readonly stream: string;
  readonly entry: Entry;
  readonly attempt: number;
}
