import type { Logger } from '../../application/ports/logger';

/** Writes nothing. The default until the platform binds a real adapter. */
export class NoopLogger implements Logger {
  debug(): void {
    return undefined;
  }

  info(): void {
    return undefined;
  }

  warn(): void {
    return undefined;
  }

  error(): void {
    return undefined;
  }

  child(): Logger {
    return this;
  }

  isLevelEnabled(): boolean {
    return false;
  }

  flush(): Promise<void> {
    return Promise.resolve();
  }
}
