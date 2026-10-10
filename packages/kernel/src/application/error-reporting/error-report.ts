import type { ErrorOrigin } from './error-origin.js';
import type { ErrorReportExtensionValues } from './error-report-extension-values.js';
import type { ErrorSeverity } from './error-severity.js';

/**
 * Where and for whom an unexpected failure happened, as plain data: identifiers only, never
 * the content of a message, a request or an answer. The error itself travels next to it.
 */
export interface ErrorReport {
  readonly origin: ErrorOrigin;
  /** What was running: a route operation id, a command or query name, an event type and its consumer, a job name. */
  readonly operation: string;
  /** Bounded context, when the capture point knows it. */
  readonly context?: string;
  readonly correlationId?: string;
  /** Leads to the trace of the unit of work. An adapter may read it from the active span instead. */
  readonly traceId?: string;
  readonly actorId?: string;
  readonly tenantId?: string;
  /** The `code` of the error, when it carries a short one. */
  readonly errorCode?: string;
  readonly severity: ErrorSeverity;
  readonly extensions?: ErrorReportExtensionValues;
}
