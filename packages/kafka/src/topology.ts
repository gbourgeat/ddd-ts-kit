export interface TopicDescription {
  readonly name: string;
  /** `events` carries the events of one or several types, `dead` keeps what a consumer gave up on. */
  readonly role: 'events' | 'dead';
  /** -1: the default of the broker. */
  readonly partitions: number;
  /** -1: the default of the broker. */
  readonly replicationFactor: number;
}

export interface GroupDescription {
  readonly groupId: string;
  readonly topics: readonly string[];
}

/** Everything the bus creates or joins on the cluster, as data: for documentation and reviews. */
export interface KafkaTopology {
  readonly topics: readonly TopicDescription[];
  readonly groups: readonly GroupDescription[];
}

export interface ConsumerBinding {
  readonly consumer: string;
  readonly type: string;
}

export interface TopologySettings {
  readonly topicOf: (type: string) => string;
  readonly publishedTypes: readonly string[];
  readonly partitions: number;
  readonly replicationFactor: number;
}

/** The dead-letter topic of one consumer for one topic: two consumers never share one. */
export function deadTopicOf(consumer: string, topic: string): string {
  return `${consumer}.${topic}.dead`;
}

/** The group whose committed offsets say how far the dead-letter topics were replayed. */
export function replayGroupOf(consumer: string): string {
  return `${consumer}.replay`;
}

export function topologyOf(
  settings: TopologySettings,
  bindings: readonly ConsumerBinding[],
): KafkaTopology {
  const consumed = bindings.map(({ consumer, type }) => ({ consumer, topic: settings.topicOf(type) }));
  const names = new Map<string, TopicDescription['role']>();
  for (const type of settings.publishedTypes) {
    names.set(settings.topicOf(type), 'events');
  }
  for (const { consumer, topic } of consumed) {
    names.set(topic, 'events');
    names.set(deadTopicOf(consumer, topic), 'dead');
  }
  return {
    topics: [...names].map(([name, role]) => topicDescription(settings, name, role)),
    groups: groupsOf(consumed),
  };
}

export function topicDescription(
  settings: Pick<TopologySettings, 'partitions' | 'replicationFactor'>,
  name: string,
  role: TopicDescription['role'],
): TopicDescription {
  return { name, role, partitions: settings.partitions, replicationFactor: settings.replicationFactor };
}

function groupsOf(consumed: readonly { consumer: string; topic: string }[]): GroupDescription[] {
  const topics = new Map<string, Set<string>>();
  for (const { consumer, topic } of consumed) {
    topics.set(consumer, (topics.get(consumer) ?? new Set()).add(topic));
  }
  return [...topics].map(([groupId, names]) => ({ groupId, topics: [...names] }));
}
