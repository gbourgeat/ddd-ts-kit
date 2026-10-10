import type { ExecutionScope, ProcessedEventStore, UnitOfWork } from '@ddd-ts-kit/kernel';

/** What the application gives every consumer when it starts: each is left out when not bound. */
export interface ConsumerRuntime {
  readonly processed?: ProcessedEventStore;
  readonly scope?: ExecutionScope;
  /** With `processed`: the mark and the work of the handler commit or roll back together. */
  readonly unitOfWork?: UnitOfWork;
}
