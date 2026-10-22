import { ErrorReporter } from '@ddd-ts-kit/kernel';
import type { Resolve } from '../wiring/resolve';

/**
 * The bound reporter, resolved at each failure: what is built when the application is created
 * (the buses, the job scheduler) must build no adapter, and a test replaces the reporter later.
 */
export function lazyErrorReporter(resolve: Resolve): ErrorReporter {
  return {
    report: (error, report) => {
      resolve(ErrorReporter).report(error, report);
    },
    flush: (timeoutMs) => resolve(ErrorReporter).flush(timeoutMs),
  };
}
