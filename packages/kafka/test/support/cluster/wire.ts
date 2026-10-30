/** What a client asks of the network between it and the cluster. */
export interface Wire {
  /** Whether the cluster can be reached and answers: neither refused nor holding its replies. */
  answering(): boolean;
  /** Whether a request reaches the cluster, answered or not. */
  reaching(): boolean;
  sent(): void;
  /** Calls `listener` each time the network gets better, so that what waits on it moves. */
  onRestore(listener: () => void): void;
  /** Whether the brokers forgot the state of the idempotent producer that asks: its next send fails fatally. Answered once. */
  producerStateLost(): boolean;
}

export const RELIABLE: Wire = {
  answering: () => true,
  reaching: () => true,
  sent: () => undefined,
  onRestore: () => undefined,
  producerStateLost: () => false,
};

/**
 * The network between some clients and the cluster, which the test can sabotage: hold the
 * replies of the cluster (acknowledgements never arrive), cut the connections, refuse new ones.
 * The same sabotage as the TCP relay used against a real broker, without a socket.
 */
export class InMemoryWire implements Wire {
  /** Requests sent through this network, to know that one left the bus. */
  traffic = 0;

  private refusing = false;

  private holding = false;

  private closed = false;

  private lostProducerState = false;

  private readonly listeners = new Set<() => void>();

  answering(): boolean {
    return this.reaching() && !this.holding;
  }

  reaching(): boolean {
    return !this.refusing && !this.closed;
  }

  sent(): void {
    this.traffic += 1;
  }

  onRestore(listener: () => void): void {
    this.listeners.add(listener);
  }

  producerStateLost(): boolean {
    const lost = this.lostProducerState;

    this.lostProducerState = false;

    return lost;
  }

  /** The brokers lose the state of the next idempotent producer that sends: a fatal error, as after a long outage. */
  forgetProducerState(): void {
    this.lostProducerState = true;
  }

  holdReplies(): void {
    this.holding = true;
  }

  /** A client reconnects at once by itself: only a refusal keeps it away. */
  cutConnections(): void {
    this.restored();
  }

  refuseConnections(): void {
    this.refusing = true;
  }

  restore(): void {
    this.refusing = false;
    this.holding = false;
    this.restored();
  }

  close(): void {
    this.closed = true;
  }

  private restored(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
