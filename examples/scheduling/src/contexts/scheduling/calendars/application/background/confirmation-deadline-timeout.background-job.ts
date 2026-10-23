import {
  ProcessRunner,
  type BackgroundJob,
  type BackgroundJobExecution,
  type ProcessTimeoutDue,
} from '@ddd-ts-kit/kernel';
import { Background } from '@ddd-ts-kit/kernel/declarations';
import { ConfirmationDeadlineProcess } from '@/contexts/scheduling/calendars/application/processes/confirmation-deadline.process';

/** A deadline delivered three times without success is dead: the expiry job still expires the appointment. */
const MAX_ATTEMPTS = 3;

/** Delivers the timeouts of the confirmation deadlines, each when it is due. */
@Background({ maxAttempts: MAX_ATTEMPTS })
export class ConfirmationDeadlineTimeoutBackgroundJob implements BackgroundJob<ProcessTimeoutDue> {
  static readonly jobName = 'scheduling.confirmation-deadline-timeout';

  private readonly process = new ConfirmationDeadlineProcess();

  constructor(private readonly processes: ProcessRunner) {}

  async run(due: ProcessTimeoutDue, execution: BackgroundJobExecution): Promise<void> {
    await this.processes.timeout(ConfirmationDeadlineProcess, { ...due, jobId: execution.jobId }, (current) =>
      this.process.timedOut(due.timeout, current),
    );
  }
}
