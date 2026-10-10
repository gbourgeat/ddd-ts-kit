import type { ErrorReport } from '../error-reporting/error-report.js';

/**
 * Where unexpected failures go to be looked at: an error tracker. Called by what stands around
 * the use cases (a bus middleware, the route pipeline, the job scheduler, the hooks of an event
 * provider, the process), never by a handler, an aggregate or a repository: they throw, and that
 * is all they say. A business refusal (`DomainError`) is not reported.
 */
export abstract class ErrorReporter {
  static {
    Object.defineProperty(this, 'tokenKey', { value: 'kernel.ErrorReporter' });
  }

  /** Queues the failure and returns at once: never throws, never waits for the tracker. */
  abstract report(error: unknown, report: ErrorReport): void;

  /**
   * Waits until nothing queued is left to send, `timeoutMs` at most, before the process stops.
   * Answers `false` when something was still waiting. Never rejects.
   */
  abstract flush(timeoutMs: number): Promise<boolean>;
}
