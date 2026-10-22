import type { JobOptions } from '../../application/scheduling/job-options';
import type { JobSchedule } from '../../application/scheduling/job-schedule';
import type { ScheduledJob } from '../../application/scheduling/scheduled-job';
import type { Token } from '../token/token';

export interface JobDeclaration {
  readonly role: 'job';
  /** `<context>.<job-name>`: the system actor the job runs as, its lock and its metrics label. */
  readonly name: string;
  readonly schedule: JobSchedule;
  /** As written: the defaults are filled in where the job is registered. */
  readonly options: JobOptions;
  readonly implementation: new (...args: never) => ScheduledJob;
  /** The list the decorator wrote; `undefined` when the constructor states the dependencies. */
  readonly dependencies: readonly Token<unknown>[] | undefined;
}
