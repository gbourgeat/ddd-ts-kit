export interface TopicOptions {
  /** Partitions of a topic the bus creates. Default -1: `num.partitions` of the broker. */
  readonly partitions?: number;
  /** Default -1: `default.replication.factor` of the broker. Use 3 in production. */
  readonly replicationFactor?: number;
  /** Default true. With false the bus creates nothing and expects every topic to exist. */
  readonly create?: boolean;
}
