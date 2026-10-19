import type { RabbitMqEventBusOptions } from '../../src/index.js';

/**
 * Between a bus and the broker, what a test sabotages: the replies of the broker stop (the
 * confirmations never arrive), the connections are cut, new ones are refused. A TCP relay in
 * front of a real broker, a gate in front of the in-memory one.
 */
export interface Network {
  /** What the bus connects with to go through this network. */
  readonly connection: RabbitMqEventBusOptions['connection'];
  /** Grows with what the bus sends, to know that a publication left it. */
  readonly traffic: number;
  holdReplies(): void;
  cutConnections(): void;
  refuseConnections(): void;
  restore(): void;
  close(): Promise<void>;
}
