import { forKinds, retry, timeout, when, type Aspect } from '@ddd-ts-kit/aspects';
import type { ResilienceSettings } from '{{alias.platform}}/resilience/resilience-settings.js';
import { selfGoverned } from '{{alias.platform}}/resilience/self-governed.js';

/**
 * What goes around every adapter that leaves the process (`external`, `gateway`) and states no
 * policy of its own: retries with backoff, and a time limit for each attempt.
 */
export function adapterAspects(settings: ResilienceSettings): Aspect {
  const byDefault = when(
    forKinds('external', 'gateway'),
    retry({ attempts: settings.retryAttempts, backoff: { baseMs: settings.retryBaseDelayMs } }),
    timeout(settings.timeoutMs),
  );

  return (instance, info) => (selfGoverned.has(instance) ? instance : byDefault(instance, info));
}
