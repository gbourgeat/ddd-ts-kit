import type { KafkaJS } from '@confluentinc/kafka-javascript';
import { Group } from './group.js';
import { type StoredRecord, Topic } from './log.js';

/** What learns that a topic received records, or that the topics changed. */
export interface TopicListener {
  grew(topic: string): void;
}

/** What every client of one in-memory cluster shares: its topics and its consumer groups. */
export class ClusterState {
  readonly topics = new Map<string, Topic>();

  readonly groups = new Map<string, Group>();

  private readonly listeners = new Set<TopicListener>();

  private members = 0;

  nextMemberId(): number {
    this.members += 1;

    return this.members;
  }

  listen(listener: TopicListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  group(id: string): Group {
    const existing = this.groups.get(id);

    if (existing !== undefined) {
      return existing;
    }

    const group = new Group(id, (topic) => this.topics.get(topic)?.partitions.length ?? 0);

    this.groups.set(id, group);

    return group;
  }

  /** Creates a topic that does not exist; an existing one is left as it is. */
  createTopic(name: string, partitions: number): void {
    if (!this.topics.has(name)) {
      const topic = new Topic(name, partitions);

      this.topics.set(name, topic);

      setImmediate(() => {
        topic.visible = true;
      });

      this.topicsChanged(name);
    }
  }

  deleteTopic(name: string): void {
    if (this.topics.delete(name)) {
      this.topicsChanged(name);
    }
  }

  append(topicName: string, message: KafkaJS.Message<unknown, unknown>, timestamp: number): KafkaJS.RecordMetadata {
    const topic = this.topics.get(topicName);

    if (topic === undefined) {
      throw new Error(`unknown topic ${topicName}`);
    }

    const key = bytesOf(message.key);
    const partition = topic.partitionOf(key, message.partition);

    const offset = topic.append(partition, {
      key,
      value: bytesOf(message.value),
      headers: headersOf(message.headers),
      timestamp: message.timestamp ?? String(timestamp),
    });

    for (const listener of this.listeners) {
      listener.grew(topicName);
    }

    return { topicName, partition, errorCode: 0, offset: String(offset), baseOffset: String(offset) };
  }

  recordAt(topic: string, partition: number, offset: bigint): StoredRecord | undefined {
    return this.topics.get(topic)?.recordAt(partition, offset);
  }

  /** A group subscribed to a topic that appears or goes shares its partitions out again. */
  private topicsChanged(topic: string): void {
    for (const group of this.groups.values()) {
      if ([...group.members.values()].some((member) => member.topics.has(topic))) {
        group.rebalance();
      }
    }
  }
}

/** A key or a value as the producer gave it, as the bytes a consumer reads back. */
function bytesOf(value: unknown): Buffer | null {
  if (value === null || value === undefined) {
    return null;
  }

  return Buffer.isBuffer(value) ? value : Buffer.from(String(value));
}

function headersOf(headers: KafkaJS.IHeaders | undefined): KafkaJS.IHeaders {
  const stored: KafkaJS.IHeaders = {};

  for (const [name, value] of Object.entries(headers ?? {})) {
    if (value !== undefined) {
      stored[name] = Array.isArray(value) ? value.map((item) => Buffer.from(item)) : Buffer.from(value);
    }
  }

  return stored;
}
