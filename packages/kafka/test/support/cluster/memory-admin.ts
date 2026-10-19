import { KafkaJS } from '@confluentinc/kafka-javascript';
import { ClientState, answered } from './client-basics.js';
import type { ClusterState } from './cluster-state.js';
import { Unsupported, kafkaError } from './errors.js';
import type { Topic } from './log.js';
import type { Wire } from './wire.js';

/** The administrative client: topics, their offsets and metadata, the groups and their offsets. */
export class MemoryAdmin implements KafkaJS.Admin {
  private readonly client: ClientState;

  constructor(
    private readonly cluster: ClusterState,
    private readonly wire: Wire,
  ) {
    this.client = new ClientState(wire);
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    this.client.disconnect();
  }

  async createTopics({ topics }: { topics: KafkaJS.ITopicConfig[] }): Promise<boolean> {
    await this.request('createTopics');

    for (const { topic, numPartitions } of topics) {
      this.cluster.createTopic(topic, numPartitions ?? 1);
    }

    return true;
  }

  async deleteTopics({ topics }: { topics: string[] }): Promise<void> {
    await this.request('deleteTopics');

    for (const topic of topics) {
      this.cluster.deleteTopic(topic);
    }
  }

  async listTopics(): Promise<string[]> {
    await this.request('listTopics');

    return [...this.cluster.topics.keys()];
  }

  async clusterId(): Promise<string> {
    return 'in-memory';
  }

  async listGroups(): Promise<{ groups: KafkaJS.GroupOverview[]; errors: KafkaJS.LibrdKafkaError[] }> {
    await this.request('listGroups');

    const groups = [...this.cluster.groups.keys()].map((groupId) => ({
      groupId,
      protocolType: 'consumer',
      isSimpleConsumerGroup: false,
      state: KafkaJS.ConsumerGroupStates.STABLE,
      type: KafkaJS.ConsumerGroupTypes.CLASSIC,
    }));

    return { groups, errors: [] };
  }

  async describeGroups(): Promise<KafkaJS.GroupDescriptions> {
    throw new Unsupported('describeGroups');
  }

  /** Deletes the groups that have no member left; a group with members stays. */
  async deleteGroups(groupIds: string[]): Promise<KafkaJS.DeleteGroupsResult[]> {
    await this.request('deleteGroups');

    return groupIds.map((groupId) => {
      if ((this.cluster.groups.get(groupId)?.members.size ?? 0) === 0) {
        this.cluster.groups.delete(groupId);
      }

      return { groupId, errorCode: 0 };
    });
  }

  async fetchOffsets({
    groupId,
    topics,
  }: {
    groupId: string;
    topics?: KafkaJS.TopicInput;
  }): Promise<{ topic: string; partitions: KafkaJS.FetchOffsetsPartition[] }[]> {
    await this.request('fetchOffsets');
    const group = this.cluster.groups.get(groupId);
    const names = (topics ?? []).map((entry) => (typeof entry === 'string' ? entry : entry.topic));

    return names.flatMap((name) => {
      const topic = this.cluster.topics.get(name);

      if (topic === undefined) {
        return [];
      }

      const partitions = topic.partitions.map((_, partition) => ({
        partition,
        offset: String(group?.committedOffset(name, partition) ?? -1n),
        metadata: null,
        leaderEpoch: null,
        error: null,
      }));

      return [{ topic: name, partitions }];
    });
  }

  async deleteTopicRecords(): Promise<KafkaJS.DeleteRecordsResult[]> {
    throw new Unsupported('deleteTopicRecords');
  }

  async fetchTopicMetadata({ topics }: { topics?: string[] } = {}): Promise<KafkaJS.ITopicMetadata[]> {
    await this.request('fetchTopicMetadata');

    return (topics ?? [...this.cluster.topics.keys()]).map((name) => metadataOf(this.listed(name)));
  }

  async fetchTopicOffsets(name: string): Promise<(KafkaJS.SeekEntry & { high: string; low: string })[]> {
    await this.request('fetchTopicOffsets');
    const topic = this.known(name);

    return topic.partitions.map((_, partition) => {
      const high = String(topic.endOf(partition));

      return { partition, offset: high, high, low: '0' };
    });
  }

  async fetchTopicOffsetsByTimestamp(): Promise<KafkaJS.SeekEntry[]> {
    throw new Unsupported('fetchTopicOffsetsByTimestamp');
  }

  /** A request waits for the cluster to answer; the caller bounds how long. */
  private async request(operation: string): Promise<void> {
    this.client.ensureConnected(operation);
    this.wire.sent();
    await answered(this.wire);
  }

  private listed(name: string): Topic {
    const topic = this.known(name);

    if (!topic.visible) {
      throw kafkaError('ERR_UNKNOWN_TOPIC_OR_PART', 'Broker: Unknown topic or partition');
    }

    return topic;
  }

  private known(name: string): Topic {
    const topic = this.cluster.topics.get(name);

    if (topic === undefined) {
      throw kafkaError('ERR_UNKNOWN_TOPIC_OR_PART', 'Broker: Unknown topic or partition');
    }

    return topic;
  }
}

function metadataOf(topic: Topic): KafkaJS.ITopicMetadata {
  const partitions = topic.partitions.map((_, partitionId) => ({
    partitionErrorCode: 0,
    partitionId,
    leader: 1,
    replicas: [1],
    isr: [1],
  }));

  return { name: topic.name, partitions };
}
