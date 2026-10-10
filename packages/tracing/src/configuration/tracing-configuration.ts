import type { ExecutionScope } from '@ddd-ts-kit/kernel';

export interface TracingConfiguration {
  /** Dependency spans sharing one name allowed under one local root. */
  readonly maxSpansPerName: number;
  /** Dependency spans allowed in total under one local root. */
  readonly maxSpansPerRoot: number;
  /** Method names never wrapped: frameworks call them outside of any request. */
  readonly lifecycleHooks: readonly string[];
  /**
   * When given, the local root span of each unit of work names its correlation id and its
   * origin (`app.correlation_id`, `app.origin`), and `traceLogFields()` carries the log fields
   * of the execution context. Never the actor, the tenant or the session.
   */
  readonly executionScope?: ExecutionScope;
}
