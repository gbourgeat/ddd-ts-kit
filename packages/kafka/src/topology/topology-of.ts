import type { ConsumerBinding } from './consumer-binding.js';
import { deadTopicOf } from './dead-topic-of.js';
import { describeTopic } from './describe-topic.js';
import type { GroupDescription } from './group-description.js';
import type { KafkaTopology } from './kafka-topology.js';
import type { TopicDescription } from './topic-description.js';
import type { TopologySettings } from './topology-settings.js';

export function topologyOf(settings: TopologySettings, bindings: readonly ConsumerBinding[]): KafkaTopology {
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
    topics: [...names].map(([name, role]) => describeTopic(settings, name, role)),
    groups: groupsOf(consumed),
  };
}

function groupsOf(consumed: readonly { consumer: string; topic: string }[]): GroupDescription[] {
  const topics = new Map<string, Set<string>>();

  for (const { consumer, topic } of consumed) {
    topics.set(consumer, (topics.get(consumer) ?? new Set()).add(topic));
  }

  return [...topics].map(([groupId, names]) => ({ groupId, topics: [...names] }));
}
