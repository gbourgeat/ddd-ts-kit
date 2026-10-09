import { compose, forKinds, retry, timeout, when, type Aspect } from '@ddd-ts-kit/aspects';
import { traceDependency } from '@ddd-ts-kit/tracing';

/** How often an outbound call is tried again, from which delay, and how long one attempt may last. */
export interface ResilienceSettings {
  readonly retryAttempts: number;
  readonly retryBaseDelayMs: number;
  readonly timeoutMs: number;
}

/** What the tools and the tests run with; `main.ts` gives the validated values of `config.ts`. */
export const DEFAULT_RESILIENCE: ResilienceSettings = { retryAttempts: 3, retryBaseDelayMs: 100, timeoutMs: 2000 };

const selfGoverned = new WeakSet<object>();

/**
 * What goes around every adapter, from outside: a span for whatever declares a kind, then, for
 * what leaves the process (`external`, `gateway`) and states no policy of its own, retries with
 * backoff and a time limit for each attempt.
 */
export function adapterAspects(settings: ResilienceSettings): Aspect {
  const byDefault = when(
    forKinds('external', 'gateway'),
    retry({ attempts: settings.retryAttempts, backoff: { baseMs: settings.retryBaseDelayMs } }),
    timeout(settings.timeoutMs),
  );
  return (instance, info) => traced(selfGoverned.has(instance) ? instance : byDefault(instance, info), info);
}

/**
 * The policy one adapter states for itself, in place of the default above:
 * `.with(ownPolicy(retry({ attempts: 5 }), timeout(500)))`. Without argument it says that the
 * class already carries its policy as decorators of `@ddd-ts-kit/aspects/decorators`; either
 * way the same aspect never runs twice.
 */
export function ownPolicy(...policy: readonly Aspect[]): Aspect {
  const stated = compose(...policy);
  return (instance, info) => {
    const governed = stated(instance, info);
    selfGoverned.add(governed);
    return governed;
  };
}

const traced: Aspect = (instance, info) =>
  info?.kind === undefined ? instance : traceDependency(instance, { kind: info.kind, ...(info.context === undefined ? {} : { context: info.context }) });
