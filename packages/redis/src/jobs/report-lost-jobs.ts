import { errorReportOf, identifyError, type ErrorReporter, type Logger } from '@ddd-ts-kit/kernel';

/**
 * The `onLostJob` of a `RedisJobStore` a composition root wires: a job a committed command
 * enqueued, or a cancellation it decided, that Redis did not take is logged, and reported when a
 * reporter is given: never dropped in silence.
 *
 *     new RedisJobStore(client, { onLostJob: reportLostJobs(logger, errors) });
 */
export function reportLostJobs(logger: Logger, errors?: ErrorReporter): (error: unknown, jobId: string) => void {
  return (error, jobId) => {
    logger.error('A background job write was lost after its unit of work committed', {
      jobId,
      ...identifyError(error),
    });

    errors?.report(
      error,
      errorReportOf(error, { origin: 'queue', operation: 'background job write', severity: 'error' }),
    );
  };
}
