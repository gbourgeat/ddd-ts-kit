import type { BackgroundJob } from './background-job';

/**
 * The class of a background job, as `enqueue` takes it: its static `jobName` names it, and its
 * `run` gives the type of the payload.
 */
export interface BackgroundJobType<Payload> {
  readonly jobName: string;
  readonly prototype: BackgroundJob<Payload>;
}
