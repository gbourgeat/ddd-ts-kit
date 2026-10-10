import type { ExecutionContext } from '@ddd-ts-kit/kernel';

export interface RequestContext {
  readonly requestId: string;
  /**
   * What this request carries for everything it causes: correlation id, actor, session, locale,
   * deadline, origin `http`. The same object the execution scope runs the handler in.
   */
  readonly execution: ExecutionContext;
  readonly principal?: unknown;
  /** The framework's own request object, for the rare case the neutral input is not enough. */
  readonly raw: unknown;
}
