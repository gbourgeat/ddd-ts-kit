import type { ErrorReport } from '../../application/error-reporting/error-report.js';
import type { ErrorReporter } from '../../application/ports/error-reporter.js';

export interface ReportedError {
  readonly error: unknown;
  readonly report: ErrorReport;
}

/** The fake: every reported failure is data a test asserts, in order. */
export class InMemoryErrorReporter implements ErrorReporter {
  readonly reports: ReportedError[] = [];

  report(error: unknown, report: ErrorReport): void {
    this.reports.push({ error, report });
  }

  flush(): Promise<boolean> {
    return Promise.resolve(true);
  }

  clear(): void {
    this.reports.length = 0;
  }
}
