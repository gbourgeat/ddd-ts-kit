import type { KafkaJS } from '@confluentinc/kafka-javascript';

/** What a bus connects with: bootstrap brokers, or a client of the in-memory cluster. */
export type NetworkConnection = { readonly brokers: string } | { readonly cluster: KafkaJS.Kafka };

/**
 * Between a bus and the cluster, what a test sabotages: the replies stop (the acknowledgements
 * never arrive), the connections are cut, new ones are refused. A TCP relay in front of a real
 * broker, a gate in front of the in-memory cluster.
 */
export interface Network {
  /** What the bus connects with to go through this network. */
  readonly connection: NetworkConnection;
  /** Grows with what the bus sends, to know that a publication left it. */
  readonly traffic: number;
  holdReplies(): void;
  cutConnections(): void;
  refuseConnections(): void;
  restore(): void;
  close(): Promise<void>;
}
