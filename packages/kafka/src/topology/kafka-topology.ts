import type { GroupDescription } from './group-description.js';
import type { TopicDescription } from './topic-description.js';

/** Everything the bus creates or joins on the cluster, as data: for documentation and reviews. */
export interface KafkaTopology {
  readonly topics: readonly TopicDescription[];
  readonly groups: readonly GroupDescription[];
}
