import type { JobDefinition, JobDescription, JobRun, JobScheduler, JobSettings } from '@ddd-ts-kit/kernel';

type Run = JobDefinition['run'];

/** Wraps one run in what observes it from outside (its span), named after the job and its context. */
type ObserveRun = (run: Run, job: { readonly name: string; readonly context: string }) => Run;

/**
 * The scheduler of the platform, with what `job-settings.ts` says of a job over what its context
 * registered, and each run observed from outside.
 */
export class ConfiguredJobScheduler implements JobScheduler {
  constructor(
    private readonly scheduler: JobScheduler,
    private readonly settings: Readonly<Record<string, JobSettings>>,
    private readonly observe: ObserveRun,
  ) {}

  register(job: JobDefinition): void {
    const run = this.observe(job.run, { name: job.name, context: contextOf(job.name) });

    this.scheduler.register({ ...job, ...this.overridesOf(job.name), run });
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

  /** A key the configuration left undefined does not erase what the job declared. */
  private overridesOf(name: string): JobSettings {
    return Object.fromEntries(Object.entries(this.settings[name] ?? {}).filter(([, value]) => value !== undefined));
  }
}

/** A job is named `<context>.<job>`. */
function contextOf(jobName: string): string {
  return jobName.split('.')[0] ?? jobName;
}
