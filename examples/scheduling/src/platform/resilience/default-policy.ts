import { forKinds, retry, timeout, when, type Aspect } from '@ddd-ts-kit/aspects';
import { adaptersWithOwnPolicy } from '@/platform/resilience/adapters-with-own-policy';
import type { ResilienceSettings } from '@/platform/resilience/resilience-settings';

/**
 * What goes around every adapter that leaves the process (`external`, `gateway`) and states no
 * policy of its own: retries with backoff, and a time limit for each attempt. `forKinds` is the
 * filter: a platform wired by hand gives every adapter to it, the tsyringe module only those two kinds.
 */
export function defaultPolicy(settings: ResilienceSettings): Aspect {
  const policy = when(
    forKinds('external', 'gateway'),
    retry({ attempts: settings.retryAttempts, backoff: { baseMs: settings.retryBaseDelayMs } }),
    timeout(settings.timeoutMs),
  );

  return (instance, info) => (adaptersWithOwnPolicy.has(instance) ? instance : policy(instance, info));
}
