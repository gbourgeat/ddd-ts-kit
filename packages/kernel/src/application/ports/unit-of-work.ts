/**
 * Runs `work` atomically. The domain events of the aggregates it saves wait until `work` has
 * returned, then are dispatched inside it, before the commit: what their handlers write, the
 * outbox included, commits or rolls back with it. The handlers of the `after-commit` phase run
 * once it has committed. An implementation gets all of it from `withinUnitOfWork`.
 */
export abstract class UnitOfWork {
  static {
    Object.defineProperty(this, 'tokenKey', { value: 'kernel.UnitOfWork' });
  }

  abstract run<T>(work: () => Promise<T>): Promise<T>;
}
