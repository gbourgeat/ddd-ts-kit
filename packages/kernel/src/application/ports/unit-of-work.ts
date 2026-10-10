/** Runs `work` atomically; domain events are published only when it commits. */
export abstract class UnitOfWork {
  static readonly tokenKey = 'kernel.UnitOfWork';

  abstract run<T>(work: () => Promise<T>): Promise<T>;
}
