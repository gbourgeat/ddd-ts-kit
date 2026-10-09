export type DependencyKind =
  | 'repository'
  | 'gateway'
  | 'external'
  | 'use-case'
  | 'publisher'
  | 'consumer';

export interface TracingConfiguration {
  /** Dependency spans sharing one name allowed under one local root. */
  readonly maxSpansPerName: number;
  /** Dependency spans allowed in total under one local root. */
  readonly maxSpansPerRoot: number;
  /** Method names never wrapped: frameworks call them outside of any request. */
  readonly lifecycleHooks: readonly string[];
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
