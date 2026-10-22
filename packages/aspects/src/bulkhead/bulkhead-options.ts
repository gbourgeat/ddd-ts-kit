import type { StateScope } from '../state/state-scope';

export interface BulkheadOptions {
  /** Calls running at once. */
  readonly maxConcurrent: number;
  /** Calls waiting for a place, in order. Default 0: beyond `maxConcurrent`, refuse at once. */
  readonly maxQueued?: number;
  /** One compartment per method (the default), or one shared by the methods of the instance. */
  readonly scope?: StateScope;
}
