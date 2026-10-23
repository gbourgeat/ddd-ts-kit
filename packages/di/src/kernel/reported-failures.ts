import { ExecutionScope, errorReportingMiddleware, type BusMiddleware } from '@ddd-ts-kit/kernel';
import type { Resolve } from '../wiring/resolve';
import { lazyErrorReporter } from './lazy-error-reporter';

/** Resolved at each failure, so the reporter and the scope may be bound, rebound or faked after the bus exists. */
export function reportedFailures(resolve: Resolve): BusMiddleware {
  return errorReportingMiddleware(lazyErrorReporter(resolve), {
    current: () => resolve(ExecutionScope).current(),
  });
}
