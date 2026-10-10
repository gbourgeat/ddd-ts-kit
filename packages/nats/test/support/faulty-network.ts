import { createConnection, createServer, type Server, type Socket } from 'node:net';
import type { AddressInfo } from 'node:net';

/**
 * A TCP relay between a bus and the broker that the test can sabotage: stop passing the
 * replies of the broker (confirmations never arrive), cut every connection, refuse new ones.
 * It is how a network failure is produced for real, without touching the broker.
 */
export class FaultyNetwork {
  private readonly sockets = new Set<Socket>();

  private repliesHeld = false;

  private refusing = false;

  bytesFromClient = 0;

  private constructor(
    private readonly server: Server,
    private readonly target: URL,
  ) {
    server.on('connection', (client) => {
      this.relay(client);
    });
  }

  static async to(brokerUrl: string): Promise<FaultyNetwork> {
    const server = createServer();

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

    return new FaultyNetwork(server, new URL(brokerUrl));
  }

  /** The broker URL, through this relay. */
  get url(): string {
    const through = new URL(this.target.href);

    through.hostname = '127.0.0.1';
    through.port = String((this.server.address() as AddressInfo).port);

    return through.href;
  }

  holdReplies(): void {
    this.repliesHeld = true;
  }

  cutConnections(): void {
    for (const socket of this.sockets) {
      socket.destroy();
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
    this.cutConnections();
    await new Promise((resolve) => this.server.close(resolve));
  }

  private relay(client: Socket): void {
    if (this.refusing) {
      client.destroy();

      return;
    }

    const broker = createConnection({
      host: this.target.hostname,
      port: Number(this.target.port || 4222),
    });

    for (const socket of [client, broker]) {
      this.sockets.add(socket);
      socket.on('error', () => undefined);

      socket.on('close', () => {
        this.sockets.delete(socket);
        client.destroy();
        broker.destroy();
      });
    }

    client.on('data', (data) => {
      this.bytesFromClient += data.length;
      broker.write(data);
    });

    broker.on('data', (data) => {
      if (!this.repliesHeld) {
        client.write(data);
      }
    });
  }
}
