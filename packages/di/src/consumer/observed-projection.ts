import { Clock, Metrics, RowNotHeldError, type MetricLabels } from '@ddd-ts-kit/kernel';
import type { Resolve } from '../wiring/resolve';

export interface ProjectedEvent {
  /** Name of the projection. */
  readonly projection: string;
  /** Name of the module that declared it. */
  readonly context: string;
  /** The type of the integration event, or the name of the domain event. */
  readonly event: string;
}

type Applying = (occurredAt: Date, apply: () => Promise<unknown>) => Promise<void>;

/** What a write answers when it wrote or removed no row: counted under its own name, and no measure of the lag. */
const SKIPPED = new Set<unknown>(['traced', 'stale', 'ignored']);

/**
 * What measures a projection from outside, through the `Metrics` port: `projection_events_total`
 * counts each event by `result` (`applied`, `traced`, `stale`, `ignored`, `early`, `failed`), and
 * `projection_last_event_age_ms` is the age of the last event applied when it was, which is
 * the lag of the projection. `early` is an event thrown back because the row it changes is not
 * held yet (`RowNotHeldError`): it failed as any other, and is counted apart because a delivery
 * out of order is not a defect. Each delivery counts, so an event that is never preceded by its
 * creation counts `early` until its provider dead-letters it. Without a bound `Metrics`, nothing
 * is measured.
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
        counted(error instanceof RowNotHeldError ? 'early' : 'failed');

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
