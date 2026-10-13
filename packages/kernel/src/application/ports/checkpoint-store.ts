/**
 * How far each subscription to an event store has applied the store. Kept in the database of what
 * the subscription writes, a checkpoint commits with what it applied.
 */
export abstract class CheckpointStore {
  static {
    Object.defineProperty(this, 'tokenKey', { value: 'kernel.CheckpointStore' });
  }

  /** The last position the subscriber applied, 0 when it applied nothing yet. */
  abstract position(subscriber: string): Promise<number>;

  /**
   * Moves the checkpoint from `from` to `to`, and refuses with a ConcurrencyError when it is no
   * longer at `from`: another run of the same subscriber applied the same events first.
   */
  abstract advance(subscriber: string, from: number, to: number): Promise<void>;
}
