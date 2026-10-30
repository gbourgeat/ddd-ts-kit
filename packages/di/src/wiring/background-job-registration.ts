import type { BackgroundJob, BackgroundJobOptions, BackgroundJobPayloadSchema } from '@ddd-ts-kit/kernel';
import type { Token } from '@ddd-ts-kit/kernel/declarations';
import type { Declarer } from './declarer';

/** A background job a context declared, for the application to register on the queue worker. */
export interface BackgroundJobRegistration {
  /** `<context>.<job-name>`: the static `jobName` of the class. */
  readonly name: string;
  readonly options: BackgroundJobOptions;
  /** What the worker reads the stored payload with before each run. */
  readonly payload: BackgroundJobPayloadSchema<unknown>;
  readonly job: Token<BackgroundJob<unknown>>;
  readonly module: string;
  readonly declaredBy?: Declarer;
}
