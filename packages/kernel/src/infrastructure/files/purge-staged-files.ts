import type { Clock } from '../../application/ports/clock';
import type { ScheduledJob } from '../../application/scheduling/scheduled-job';
import type { FileStaging } from './file-staging';

/** A day: a command that staged a file has long committed or rolled back. */
const A_DAY_MS = 86_400_000;

/**
 * The scheduled job of the platform that removes what rolled-back or crashed commands left in
 * `staging/`: the files staged more than `olderThanMs` ago (a day by default). Registered under
 * `files.purge-staged`, every hour, by the platform of a project that keeps files.
 */
export class PurgeStagedFiles implements ScheduledJob {
  constructor(
    private readonly staging: FileStaging,
    private readonly clock: Clock,
    private readonly olderThanMs: number = A_DAY_MS,
  ) {}

  async run(): Promise<void> {
    await this.staging.purge(new Date(this.clock.now().getTime() - this.olderThanMs));
  }
}
