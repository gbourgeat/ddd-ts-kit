import type { GroupDescription } from './group-description.js';
import type { StreamDescription } from './stream-description.js';

/** Everything the bus creates on the server, as data: for documentation and reviews. */
export interface RedisStreamsTopology {
  readonly streams: readonly StreamDescription[];
  readonly groups: readonly GroupDescription[];
}
