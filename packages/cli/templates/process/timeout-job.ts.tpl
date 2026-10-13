import type { BackgroundJob, BackgroundJobExecution, ProcessRunner, ProcessTimeoutDue } from '@ddd-ts-kit/kernel';
import { {{name.pascal}}Process } from '{{alias.context}}/application/processes/{{name.kebab}}.process{{alias.ext}}';

export class {{name.pascal}}TimeoutBackgroundJob implements BackgroundJob<ProcessTimeoutDue> {
  static readonly jobName = '{{process.timeoutJob}}';

  private readonly process = new {{name.pascal}}Process();

  constructor(private readonly processes: ProcessRunner) {}

  async run(due: ProcessTimeoutDue, execution: BackgroundJobExecution): Promise<void> {
    const delivered = { ...due, jobId: execution.jobId };

    await this.processes.timeout({{name.pascal}}Process, delivered, (current) => this.process.timedOut(due.timeout, current));
  }
}
