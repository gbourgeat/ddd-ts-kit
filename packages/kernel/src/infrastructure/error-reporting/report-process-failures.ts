import { errorReportOf } from '../../application/error-reporting/error-report-of.js';
import { reportOnce } from '../../application/error-reporting/report-once.js';
import type { ErrorReporter } from '../../application/ports/error-reporter.js';

type ProcessFailure = 'uncaughtException' | 'unhandledRejection';

/** The part of `process` this needs, so a test hands it something else. */
export interface CrashingProcess {
  on(event: ProcessFailure, listener: (reason: unknown) => void): unknown;
  off(event: ProcessFailure, listener: (reason: unknown) => void): unknown;
  exit(code: number): unknown;
  readonly stderr: { write(text: string): unknown };
}

export interface ProcessFailureOptions {
  /** How long the reporter is given to send the report before the process exits. Default 2 000. */
  readonly flushTimeoutMs?: number;
  /** Default: the process itself. */
  readonly target?: CrashingProcess;
}

const FAILURES: readonly ProcessFailure[] = ['uncaughtException', 'unhandledRejection'];

/**
 * Reports what nothing caught, as `fatal`, then ends the process the way Node would have
 * without a listener: the stack on the standard error, exit code 1. The only difference is
 * the time given to the reporter to send. Call it once, in the composition root; the answer
 * removes the listeners.
 */
export function reportProcessFailures(reporter: ErrorReporter, options: ProcessFailureOptions = {}): () => void {
  const target = options.target ?? process;
  const flushTimeoutMs = options.flushTimeoutMs ?? 2_000;

  const listeners = FAILURES.map((operation) => {
    const crash = (reason: unknown): void => {
      reportOnce(reporter, reason, errorReportOf(reason, { origin: 'process', operation, severity: 'fatal' }));
      target.stderr.write(`${stackOf(reason)}\n`);
      void exitAfterFlush(reporter, flushTimeoutMs, target);
    };

    target.on(operation, crash);

    return { operation, crash };
  });

  return () => {
    for (const { operation, crash } of listeners) {
      target.off(operation, crash);
    }
  };
}

function stackOf(reason: unknown): string {
  return reason instanceof Error ? (reason.stack ?? reason.message) : `Uncaught ${String(reason)}`;
}

async function exitAfterFlush(reporter: ErrorReporter, timeoutMs: number, target: CrashingProcess): Promise<void> {
  try {
    await reporter.flush(timeoutMs);
  } catch {
    // A reporter that cannot send must not keep a crashed process alive.
  }

  target.exit(1);
}
