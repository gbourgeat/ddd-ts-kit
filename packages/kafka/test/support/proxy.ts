import { createConnection, createServer, type Server, type Socket } from 'node:net';

interface Address {
  readonly host: string;
  readonly port: number;
}

/**
 * A TCP relay between a bus and the broker that the test can sabotage: stop passing the
 * replies of the broker (acknowledgements never arrive), cut every connection, refuse new
 * ones. A Kafka client connects to the addresses the broker advertises, so the relay listens
 * on the address a second listener of the broker advertises, and forwards to that listener.
 */
export class FaultyNetwork {
  readonly #sockets = new Set<Socket>();
  #repliesHeld = false;
  #refusing = false;
  bytesFromClient = 0;

  private constructor(
    private readonly server: Server,
    /** The brokers to give a bus, through this relay. */
    readonly brokers: string,
    private readonly target: Address,
  ) {
    server.on('connection', (client) => {
      this.#relay(client);
    });
  }

  /** `relay` is `<advertised host:port>=<broker host:port>`. */
  static async from(relay: string): Promise<FaultyNetwork> {
    const [advertised = '', behind = ''] = relay.split('=');
    const listening = addressOf(advertised);
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(listening.port, listening.host, resolve));
    return new FaultyNetwork(server, advertised, addressOf(behind));
  }

  holdReplies(): void {
    this.#repliesHeld = true;
  }

  cutConnections(): void {
    for (const socket of this.#sockets) {
      socket.destroy();
    }
  }

  refuseConnections(): void {
    this.#refusing = true;
  }

  restore(): void {
    this.#repliesHeld = false;
    this.#refusing = false;
  }

  async close(): Promise<void> {
    this.cutConnections();
    await new Promise((resolve) => this.server.close(resolve));
  }

  #relay(client: Socket): void {
    if (this.#refusing) {
      client.destroy();
      return;
    }
    const broker = createConnection(this.target);
    for (const socket of [client, broker]) {
      this.#sockets.add(socket);
      socket.on('error', () => undefined);
      socket.on('close', () => {
        this.#sockets.delete(socket);
        client.destroy();
        broker.destroy();
      });
    }
    client.on('data', (data) => {
      this.bytesFromClient += data.length;
      broker.write(data);
    });
    broker.on('data', (data) => {
      if (!this.#repliesHeld) {
        client.write(data);
      }
    });
  }
}

function addressOf(text: string): Address {
  const [host = '127.0.0.1', port = ''] = text.split(':');
  return { host, port: Number(port) };
}
