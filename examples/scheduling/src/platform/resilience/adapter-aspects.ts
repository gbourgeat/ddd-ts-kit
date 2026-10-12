import { forKinds, retry, timeout, when, type Aspect } from '@ddd-ts-kit/aspects';
import type { ResilienceSettings } from '@/platform/resilience/resilience-settings';
import { selfGoverned } from '@/platform/resilience/self-governed';

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
