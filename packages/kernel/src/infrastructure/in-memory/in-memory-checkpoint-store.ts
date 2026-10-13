import type { CheckpointStore } from '../../application/ports/checkpoint-store.js';
import { ConcurrencyError } from '../../domain/errors/concurrency-error.js';

/** Reference implementation, for tests and single-process apps. */
export class InMemoryCheckpointStore implements CheckpointStore {
  private readonly positions = new Map<string, number>();

  async position(subscriber: string): Promise<number> {
    return this.positions.get(subscriber) ?? 0;
  }

  async advance(subscriber: string, from: number, to: number): Promise<void> {
    if ((this.positions.get(subscriber) ?? 0) !== from) {
      throw new ConcurrencyError(subscriber);
    }

    this.positions.set(subscriber, to);
  }
}
