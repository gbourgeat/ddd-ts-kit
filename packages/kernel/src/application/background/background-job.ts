import type { BackgroundJobExecution } from './background-job-execution';

/**
 * A class of `application/background/`: work a use case hands to a worker, to run later and
 * outside of its request. Like a scheduled job it decides nothing: it triggers use cases. Its
 * name is a static `jobName`, `<context>.<job-name>`, which is also how a use case enqueues it:
 * `jobs.enqueue(CompileMonthlyReportJob, { practiceId, month })`. Its static `payload` is the
 * schema of what it works on: the worker reads the stored payload with it before each run, and a
 * payload that does not fit is never run.
 *
 * Delivery is at least once: a run may be repeated after a crash, an expired lease or a retry,
 * so the work is idempotent, and a long one saves a checkpoint to resume from.
 */
export interface BackgroundJob<Payload> {
  run(payload: Payload, execution: BackgroundJobExecution): Promise<void>;
}
