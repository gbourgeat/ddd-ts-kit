import type { BackgroundJob, BackgroundJobOptions } from '@ddd-ts-kit/kernel';

/** A background job class: named by its static `jobName`, built from what its constructor takes. */
export interface BackgroundJobClass<Deps extends readonly unknown[]> {
  readonly jobName: string;
  new (...deps: Deps): BackgroundJob<unknown>;
}

/** Where a context registers its background jobs; the application starts it when this process runs the jobs. */
export interface BackgroundJobs {
  /** Registers a job under its static `jobName`, built once from its dependencies; each attempt is observed from outside (its span), named after the job and its context. */
  register<const Deps extends readonly unknown[]>(
    job: BackgroundJobClass<Deps>,
    deps: Deps,
    options?: BackgroundJobOptions,
  ): void;

  start(): Promise<void>;

  stop(): Promise<void>;
}
