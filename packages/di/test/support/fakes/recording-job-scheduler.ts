import type { JobDefinition, JobDescription, JobRun, JobScheduler } from '@ddd-ts-kit/kernel';

/** The fake of the port: remembers what it was asked, in order, and runs a job on demand. */
export class RecordingJobScheduler implements JobScheduler {
  readonly registered: JobDefinition[] = [];

  constructor(private readonly journal: string[] = []) {}

  register(job: JobDefinition): void {
    this.registered.push(job);
  }

  async start(): Promise<void> {
    this.journal.push('jobs started');
  }

  async stop(): Promise<void> {
    this.journal.push('jobs stopped');
  }

  async runNow(name: string): Promise<JobRun> {
    const scheduledAt = new Date(0);
    const execution = { scheduledAt, startedAt: scheduledAt, attempt: 1, signal: new AbortController().signal };

    await this.registered.find((job) => job.name === name)?.run(execution);

    return { job: name, scheduledAt, outcome: 'succeeded' };
  }

  describe(): readonly JobDescription[] {
    return [];
  }
}
