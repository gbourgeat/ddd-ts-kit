import type { BackgroundJob, BackgroundJobOptions } from '@ddd-ts-kit/kernel';
import type { Token } from '@ddd-ts-kit/kernel/declarations';
import type { Declarer } from './declarer.js';

/** A background job a context declared, for the application to register on the queue worker. */
export interface BackgroundJobRegistration {
  /** `<context>.<job-name>`: the static `jobName` of the class. */
  readonly name: string;
  readonly options: BackgroundJobOptions;
  readonly job: Token<BackgroundJob<unknown>>;
  readonly module: string;
  readonly declaredBy?: Declarer;
}
