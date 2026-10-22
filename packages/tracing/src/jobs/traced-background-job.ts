import { SpanKind, context, trace } from '@opentelemetry/api';
import type { BackgroundJobExecution } from '@ddd-ts-kit/kernel';
import { workAttributes } from '../local-root/work-attributes';
import { spanContextFromTraceparent } from '../propagation/span-context-from-traceparent';
import { inSpan } from '../span/in-span';
import { OUTCOME_ATTRIBUTE } from '../span/outcome-attribute';
import type { TracedJobOptions } from './traced-job';

type BackgroundJobRun = (payload: unknown, execution: BackgroundJobExecution) => Promise<void>;

/**
 * Wraps an attempt of a background job: a CONSUMER span `job <name>`, child of the span that
 * enqueued it, so that the request and the work it handed to a worker read as one trace, every
 * attempt included. It says the job, the attempt and the outcome, never the payload.
 */
export function tracedBackgroundJob(run: BackgroundJobRun, options: TracedJobOptions): BackgroundJobRun {
  return (payload, execution) => {
    const producer =
      execution.traceparent === undefined ? undefined : spanContextFromTraceparent(execution.traceparent);

    const active = context.active();

    const attributes = {
      'app.job.name': options.name,
      ...(options.context === undefined ? {} : { 'app.context': options.context }),
      'app.job.id': execution.jobId,
      'app.job.attempt': execution.attempt,
      ...workAttributes(),
    };

    return inSpan(
      {
        name: `job ${options.name}`,
        options: { kind: SpanKind.CONSUMER, attributes },
        parent: producer === undefined ? active : trace.setSpanContext(active, producer),
      },
      async (span) => {
        await run(payload, execution);
        span.setAttribute(OUTCOME_ATTRIBUTE, 'succeeded');
      },
    );
  };
}
