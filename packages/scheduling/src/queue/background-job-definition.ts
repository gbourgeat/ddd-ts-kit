import type { BackgroundJobExecution, BackgroundJobOptions, BackgroundJobPayloadSchema } from '@ddd-ts-kit/kernel';

/** A background job as a worker receives it. */
export interface BackgroundJobDefinition {
  /** `<context>.<job-name>`: its queue is the context. */
  readonly name: string;
  readonly options?: BackgroundJobOptions;
  /**
   * What the stored payload is read with before each run, the static `payload` of the job: a
   * payload it refuses is never run, and its job is dead with `INVALID_JOB_PAYLOAD`.
   */
  readonly payload: BackgroundJobPayloadSchema<unknown>;
  /** Given the payload as `payload.parse` answers it. */
  readonly run: (payload: unknown, execution: BackgroundJobExecution) => Promise<void>;
}
