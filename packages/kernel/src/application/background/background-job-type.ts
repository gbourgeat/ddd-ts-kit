import type { BackgroundJob } from './background-job';
import type { BackgroundJobPayloadSchema } from './background-job-payload-schema';

/**
 * The class of a background job, as `enqueue` takes it: its static `jobName` names it, its
 * static `payload` is the schema the worker reads the stored payload with before each run, and
 * its `run` gives the type of the payload.
 */
export interface BackgroundJobType<Payload> {
  readonly jobName: string;
  readonly payload: BackgroundJobPayloadSchema<Payload>;
  readonly prototype: BackgroundJob<Payload>;
}
