import type { ConsumerDescription } from './consumer-description.js';
import type { StreamDescription } from './stream-description.js';

/** Everything the bus creates on the server, as data: for documentation and reviews. */
export interface NatsTopology {
  readonly streams: readonly StreamDescription[];
  readonly consumers: readonly ConsumerDescription[];
}
