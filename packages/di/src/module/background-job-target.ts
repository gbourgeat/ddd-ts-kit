import type { BackgroundJob, BackgroundJobPayloadSchema } from '@ddd-ts-kit/kernel';
import type { Dependencies, DependencyList, DependencyTokens } from '@ddd-ts-kit/kernel/declarations';
import type { Resolve } from '../wiring/resolve';

/** What the class of a background job carries next to its `jobName`: the schema of its payload. */
export interface PayloadDeclared {
  readonly payload: BackgroundJobPayloadSchema<unknown>;
}

/** Where a background job is bound: the worker reads its stored payload with its schema before each run. */
export interface BackgroundJobTarget {
  /**
   * Binds the class as a singleton, under itself; its constructor arguments are the listed
   * ports, and its static `payload` is the schema of its payload.
   */
  handledBy<Args extends readonly unknown[], const List extends Dependencies = DependencyTokens<Args>>(
    handler: (new (...args: Args) => BackgroundJob<unknown>) & PayloadDeclared,
    ...dependencies: DependencyList<Args, List>
  ): void;

  /** No class names a job built by a factory: `payload` is the schema of its payload. */
  handledByFactory(
    factory: (resolve: Resolve) => BackgroundJob<unknown>,
    payload: BackgroundJobPayloadSchema<unknown>,
  ): void;
}
