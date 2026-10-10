import type { ExecutionContext } from '../execution/execution-context.js';
import { identifyError } from '../logging/identify-error.js';
import type { ErrorReport } from './error-report.js';

/** What the capture point knows by itself. `origin` and `correlationId` only count outside of an execution context. */
export type ErrorReportSource = Pick<ErrorReport, 'origin' | 'operation'> &
  Partial<Omit<ErrorReport, 'origin' | 'operation'>>;

/**
 * The report of a failure: what the capture point says, completed from the execution context
 * of the unit of work (origin, correlation, actor and tenant ids) and from the error (its code).
 * The severity defaults to `error`.
 */
export function errorReportOf(
  error: unknown,
  source: ErrorReportSource,
  execution?: ExecutionContext,
): ErrorReport {
  const errorCode = source.errorCode ?? identifyError(error).errorCode;

  return {
    severity: 'error',
    ...source,
    ...(errorCode === undefined ? {} : { errorCode }),
    ...(execution === undefined ? {} : identifiersOf(execution)),
  };
}

function identifiersOf(execution: ExecutionContext): Partial<ErrorReport> {
  return {
    origin: execution.origin,
    correlationId: execution.correlationId,
    actorId: execution.actor.id,
    ...(execution.tenantId === undefined ? {} : { tenantId: execution.tenantId }),
  };
}
