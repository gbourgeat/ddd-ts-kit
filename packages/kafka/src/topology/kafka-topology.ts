import type { GroupDescription } from './group-description';
import type { TopicDescription } from './topic-description';

/** Everything the bus creates or joins on the cluster, as data: for documentation and reviews. */
export interface KafkaTopology {
  readonly topics: readonly TopicDescription[];
  readonly groups: readonly GroupDescription[];
}
