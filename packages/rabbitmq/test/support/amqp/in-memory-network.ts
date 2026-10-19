import type { ChannelModel } from 'amqplib';
import { ConnectionRefused } from './errors.js';
import type { InMemoryAmqp } from './in-memory-amqp.js';
import type { MemoryConnection } from './memory-connection.js';
import type { Wire } from './model.js';

/**
 * The network between a bus and the broker: it can stop passing the replies of the broker
 * (confirmations never arrive), cut every connection made through it and refuse new ones.
 * The same sabotage as the TCP relay used against a real broker, without a socket.
 */
export class InMemoryNetwork implements Wire {
  private readonly connections = new Set<MemoryConnection>();

  private refusing = false;

  private closed = false;

  private repliesHeld = false;

  /** Publications sent through this network, to know that one left the bus. */
  traffic = 0;

  constructor(private readonly broker: InMemoryAmqp) {}

  readonly connection = async (): Promise<ChannelModel> => {
    if (this.closed || this.refusing) {
      throw new ConnectionRefused();
    }

    const connection = await this.broker.open(this);

    this.connections.add(connection);
    connection.once('close', () => this.connections.delete(connection));

    return connection;
  };

  holdingReplies(): boolean {
    return this.repliesHeld;
  }

  sent(): void {
    this.traffic += 1;
  }

  holdReplies(): void {
    this.repliesHeld = true;
  }

  cutConnections(): void {
    for (const connection of [...this.connections]) {
      connection.sever();
    }
  }

  refuseConnections(): void {
    this.refusing = true;
  }

  restore(): void {
    this.repliesHeld = false;
    this.refusing = false;
  }

  async close(): Promise<void> {
    this.closed = true;
    this.cutConnections();
  }
}
