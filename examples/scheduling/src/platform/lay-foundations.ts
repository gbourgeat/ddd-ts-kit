import {
  AsyncLocalStorageExecutionScope,
  SystemClock,
  UuidGenerator,
  type Clock,
  type ExecutionScope,
  type IdGenerator,
  type Logger,
  type Metrics,
} from '@ddd-ts-kit/kernel';
import { traceApplication, type ConsumerTrace, type TracedApplication } from '@ddd-ts-kit/tracing';
import { createAudit, type Audit } from './audit/create-audit.js';
import type { Persistence } from './database/persistence.js';
import { createLogger, type LogSettings } from './observability/create-logger.js';
import { createMetrics } from './observability/create-metrics.js';

/**
 * What exists before any module: built once and handed to the kernel module, so that the buses,
 * the logger, the audit sources and every adapter read one execution scope, one clock and one
 * generator.
 */
export interface Foundations {
  readonly scope: ExecutionScope;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly logger: Logger;
  readonly metrics: Metrics;
  /** What observes the application from outside: handed to the kernel module, and to the buses this platform builds itself. */
  readonly traced: TracedApplication;
  readonly audit: Audit;
}

interface Observed {
  /** Where log entries go; left out, the application writes nothing. */
  readonly log?: LogSettings;
  /** Whether a consumed event continues the trace of its publication (the default) or starts one linked to it. */
  readonly traceConsumers?: ConsumerTrace;
}

export function layFoundations(persistence: Persistence, options: Observed): Foundations {
  const scope = new AsyncLocalStorageExecutionScope();
  const clock = new SystemClock();
  const ids = new UuidGenerator();
  const logger = createLogger(scope, options.log);

  return {
    scope,
    clock,
    ids,
    logger,
    metrics: createMetrics(),
    traced: traceApplication({ consumers: options.traceConsumers ?? 'continue' }),
    audit: createAudit(persistence, { scope, clock, ids }),
  };
}
