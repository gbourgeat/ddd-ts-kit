import type { BackgroundJob, BackgroundJobExecution, ProcessRunner, ProcessTimeoutDue } from '@ddd-ts-kit/kernel';
import { Background } from '@ddd-ts-kit/kernel/declarations';
import { {{name.pascal}}Process } from '{{alias.context}}/application/processes/{{name.kebab}}.process{{alias.ext}}';

@Background()
export class {{name.pascal}}TimeoutBackgroundJob implements BackgroundJob<ProcessTimeoutDue> {
  static readonly jobName = '{{process.timeoutJob}}';

  private readonly process = new {{name.pascal}}Process();

  constructor(private readonly processes: ProcessRunner) {}

  async run(due: ProcessTimeoutDue, execution: BackgroundJobExecution): Promise<void> {
    await this.processes.timeout({{name.pascal}}Process, { ...due, jobId: execution.jobId }, (current) =>
      this.process.timedOut(due.timeout, current),
    );
  }
}
