export interface TopologySettings {
  readonly topicOf: (type: string) => string;
  readonly publishedTypes: readonly string[];
  readonly partitions: number;
  readonly replicationFactor: number;
}
