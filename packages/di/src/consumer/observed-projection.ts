import { Clock, Metrics, type MetricLabels } from '@ddd-ts-kit/kernel';
import type { Resolve } from '../wiring/resolve.js';

export interface ProjectedEvent {
  /** Name of the projection. */
  readonly projection: string;
  /** Name of the module that declared it. */
  readonly context: string;
  /** The type of the integration event, or the name of the domain event. */
  readonly event: string;
}

type Applying = (occurredAt: Date, apply: () => Promise<unknown>) => Promise<void>;

const SKIPPED = new Set<unknown>(['stale', 'ignored']);

/**
 * What measures a projection from outside, through the `Metrics` port: `projection_events_total`
 * counts each event by `result` (`applied`, `stale`, `ignored`, `failed`), and
 * `projection_last_event_age_ms` is the age of the last event applied when it was, which is
 * the lag of the projection. Without a bound `Metrics`, nothing is measured.
 */
export function observedProjection(resolve: Resolve, { projection, context, event }: ProjectedEvent): Applying {
  const metrics = bound(resolve, Metrics);
  const clock = bound(resolve, Clock);

  if (metrics === undefined) {
    return unobserved;
  }

  const labels: MetricLabels = { context, projection };

  const counted = (result: string): void => {
    metrics.counter('projection_events_total').increment({ ...labels, event, result });
  };

  return async (occurredAt, apply) => {
    const result = await apply().then(
      (outcome) => (SKIPPED.has(outcome) ? String(outcome) : 'applied'),
      (error: unknown) => {
        counted('failed');

        throw error;
      },
    );

    counted(result);

    if (result === 'applied') {
      metrics
        .gauge('projection_last_event_age_ms')
        .set((clock?.now().getTime() ?? Date.now()) - occurredAt.getTime(), labels);
    }
  };
}

async function unobserved(_occurredAt: Date, apply: () => Promise<unknown>): Promise<void> {
  await apply();
}

/** A port of the kernel module, or nothing when the application binds none. */
function bound<T>(resolve: Resolve, port: abstract new (...args: never) => T): T | undefined {
  try {
    return resolve(port);
  } catch {
    return undefined;
  }
}
