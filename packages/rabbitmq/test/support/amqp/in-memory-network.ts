import type { ChannelModel } from 'amqplib';
import { ConnectionRefused } from './errors';
import type { Opening, Severable, Wire } from './model';

/**
 * The network between a bus and the broker: it can stop passing the replies of the broker
 * (confirmations never arrive), cut every connection made through it and refuse new ones.
 * The same sabotage as the TCP relay used against a real broker, without a socket.
 */
export class InMemoryNetwork implements Wire {
  private readonly connections = new Set<Severable>();

  private refusing = false;

  private closed = false;

  private repliesHeld = false;

  private closing = false;

  /** Publications sent through this network, to know that one left the bus. */
  traffic = 0;

  constructor(private readonly broker: Opening) {}

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

  closingChannels(): boolean {
    return this.closing;
  }

  sent(): void {
    this.traffic += 1;
  }

  beginClosing(): void {
    this.closing = true;
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
    this.closing = false;
    this.refusing = false;
  }

  async close(): Promise<void> {
    this.closed = true;
    this.cutConnections();
  }
}
