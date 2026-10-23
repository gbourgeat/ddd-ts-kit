import type { TopicDescription } from './topic-description';
import type { TopologySettings } from './topology-settings';

/** A topic with the partitions and the replication the bus creates its topics with. */
export function describeTopic(
  settings: Pick<TopologySettings, 'partitions' | 'replicationFactor'>,
  name: string,
  role: TopicDescription['role'],
): TopicDescription {
  return { name, role, partitions: settings.partitions, replicationFactor: settings.replicationFactor };
}
