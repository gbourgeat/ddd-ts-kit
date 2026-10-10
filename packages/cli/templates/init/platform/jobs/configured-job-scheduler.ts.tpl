import type { JobDefinition, JobDescription, JobRun, JobScheduler, JobSettings } from '@ddd-ts-kit/kernel';

type Run = JobDefinition['run'];

/** What is put around each run from outside (its span): told the job and the context its name starts with. */
type Observe = (run: Run, job: { readonly name: string; readonly context: string }) => Run;

/**
 * The scheduler of the platform with the settings of the configuration applied: what
 * `job-settings.ts` says of a job wins over what its context registered, and a key left
 * undefined changes nothing. Each run goes through what observes the jobs from outside.
 */
export class ConfiguredJobScheduler implements JobScheduler {
  constructor(
    private readonly scheduler: JobScheduler,
    private readonly settings: Readonly<Record<string, JobSettings>>,
    private readonly observe: Observe,
  ) {}

  register(job: JobDefinition): void {
    const written = Object.entries(this.settings[job.name] ?? {}).filter(([, value]) => value !== undefined);

    const run = this.observe(job.run, { name: job.name, context: job.name.split('.')[0] ?? job.name });

    this.scheduler.register({ ...job, ...Object.fromEntries(written), run });
  }

  start(): Promise<void> {
    return this.scheduler.start();
  }

  stop(): Promise<void> {
    return this.scheduler.stop();
  }

  runNow(name: string): Promise<JobRun> {
    return this.scheduler.runNow(name);
  }

  describe(): readonly JobDescription[] {
    return this.scheduler.describe();
  }
}
