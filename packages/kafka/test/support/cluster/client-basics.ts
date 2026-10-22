import type { KafkaJS } from '@confluentinc/kafka-javascript';
import { kafkaError } from './errors';
import type { Wire } from './wire';

const SILENT: KafkaJS.Logger = {
  info: () => undefined,
  error: () => undefined,
  warn: () => undefined,
  debug: () => undefined,
  namespace: () => SILENT,
  setLogLevel: () => undefined,
};

export const silentLogger = (): KafkaJS.Logger => SILENT;

/**
 * Resolves once the network answers: a client that cannot reach the cluster keeps trying, and
 * the caller decides how long it waits, as the bus does with its connection timeout.
 */
export function answered(wire: Wire): Promise<void> {
  if (wire.answering()) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    wire.onRestore(() => {
      if (wire.answering()) {
        resolve();
      }
    });
  });
}

/** The connection state of one client: what it refuses before `connect` and after `disconnect`. */
export class ClientState {
  private connected = false;

  constructor(private readonly wire: Wire) {}

  get isConnected(): boolean {
    return this.connected;
  }

  async connect(): Promise<void> {
    await answered(this.wire);
    this.connected = true;
  }

  disconnect(): void {
    this.connected = false;
  }

  ensureConnected(operation: string): void {
    if (!this.connected) {
      throw kafkaError('ERR__STATE', `${operation} can only be called while connected.`);
    }
  }
}
