import { DEFAULT_LIFECYCLE_HOOKS } from './default-lifecycle-hooks.js';
import type { TracingConfiguration } from './tracing-configuration.js';

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
