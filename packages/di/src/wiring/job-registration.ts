import type { JobOptions, JobSchedule, ScheduledJob } from '@ddd-ts-kit/kernel';
import type { Token } from '@ddd-ts-kit/kernel/declarations';
import type { Declarer } from './declarer.js';

/** A job a context declared, for the application to register on the job scheduler. */
export interface JobRegistration {
  readonly name: string;
  readonly schedule: JobSchedule;
  /** As declared: the settings of the application and the defaults come on top. */
  readonly options: JobOptions;
  readonly job: Token<ScheduledJob>;
  readonly module: string;
  readonly declaredBy?: Declarer;
}
