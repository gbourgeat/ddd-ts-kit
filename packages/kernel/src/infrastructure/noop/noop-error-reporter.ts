import type { ErrorReporter } from '../../application/ports/error-reporter.js';

/** Reports nothing. The default until the platform binds a real adapter. */
export class NoopErrorReporter implements ErrorReporter {
  report(): void {
    return undefined;
  }

  flush(): Promise<boolean> {
    return Promise.resolve(true);
  }
}
