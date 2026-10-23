import type { InMemoryKafka } from './cluster/in-memory-kafka';
import { InMemoryWire } from './cluster/wire';
import type { Network, NetworkConnection } from './network';

/** A network in front of the in-memory cluster: its clients go through a wire the test sabotages. */
export class MemoryNetwork implements Network {
  private readonly wire = new InMemoryWire();

  readonly connection: NetworkConnection;

  constructor(cluster: InMemoryKafka) {
    this.connection = { cluster: cluster.through(this.wire) };
  }

  get traffic(): number {
    return this.wire.traffic;
  }

  holdReplies(): void {
    this.wire.holdReplies();
  }

  cutConnections(): void {
    this.wire.cutConnections();
  }

  refuseConnections(): void {
    this.wire.refuseConnections();
  }

  restore(): void {
    this.wire.restore();
  }

  async close(): Promise<void> {
    this.wire.close();
  }
}
