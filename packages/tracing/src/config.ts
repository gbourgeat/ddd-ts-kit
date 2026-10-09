import type { DependencyKind, ExecutionScope } from '@ddd-ts-kit/kernel';

export type { DependencyKind };

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

export const DEFAULT_LIFECYCLE_HOOKS: readonly string[] = [
  'onModuleInit',
  'onModuleDestroy',
  'onApplicationBootstrap',
  'onApplicationShutdown',
  'dispose',
];

const defaults: TracingConfiguration = {
  maxSpansPerName: 25,
  maxSpansPerRoot: 200,
  lifecycleHooks: DEFAULT_LIFECYCLE_HOOKS,
};

let current: TracingConfiguration = defaults;

/**
 * Overrides the given keys and keeps the others. Lifecycle hooks are read when an
 * instance is wrapped, the caps on every call.
 */
export function configureTracing(overrides: Partial<TracingConfiguration>): void {
  current = { ...current, ...overrides };
}

export function resetTracingConfiguration(): void {
  current = defaults;
}

export function tracingConfiguration(): TracingConfiguration {
  return current;
}
