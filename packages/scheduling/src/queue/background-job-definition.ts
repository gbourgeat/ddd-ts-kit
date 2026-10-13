import type { BackgroundJobExecution, BackgroundJobOptions } from '@ddd-ts-kit/kernel';

/** A background job as a worker receives it. */
export interface BackgroundJobDefinition {
  /** `<context>.<job-name>`: its queue is the context. */
  readonly name: string;
  readonly options?: BackgroundJobOptions;
  readonly run: (payload: unknown, execution: BackgroundJobExecution) => Promise<void>;
}
