/**
 * Runs `work` atomically. The domain events of the aggregates it saves are dispatched inside it,
 * with the save: what their handlers write, the outbox included, commits or rolls back with it.
 */
export abstract class UnitOfWork {
  static {
    Object.defineProperty(this, 'tokenKey', { value: 'kernel.UnitOfWork' });
  }

  abstract run<T>(work: () => Promise<T>): Promise<T>;
}
