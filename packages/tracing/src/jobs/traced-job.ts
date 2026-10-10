import { SpanKind } from '@opentelemetry/api';
import type { JobExecution } from '@ddd-ts-kit/kernel';
import { workAttributes } from '../local-root/work-attributes.js';
import { inSpan } from '../span/in-span.js';
import { OUTCOME_ATTRIBUTE } from '../span/outcome-attribute.js';

export interface TracedJobOptions {
  /** Name of the job, `<context>.<job>`: the span is `job <name>`. */
  readonly name: string;
  /** Bounded context the job belongs to. */
  readonly context?: string;
}

type JobRun = (execution: JobExecution) => Promise<void>;

/**
 * Wraps the run of a scheduled job: one trace per run, whose root span `job <name>` says the
 * instant the run was due, the attempt and the outcome, and whose children are the commands
 * the job sends. Always a root: a run never continues the trace of whatever armed its timer.
 */
export function tracedJob(run: JobRun, options: TracedJobOptions): JobRun {
  return (execution) => {
    const attributes = {
      'app.job.name': options.name,
      ...(options.context === undefined ? {} : { 'app.context': options.context }),
      'app.job.scheduled_at': execution.scheduledAt.toISOString(),
      'app.job.attempt': execution.attempt,
      ...workAttributes(),
    };

    return inSpan(
      { name: `job ${options.name}`, options: { kind: SpanKind.INTERNAL, root: true, attributes } },
      async (span) => {
        await run(execution);
        span.setAttribute(OUTCOME_ATTRIBUTE, 'succeeded');
      },
    );
  };
}
