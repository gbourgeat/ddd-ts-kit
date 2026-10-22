import type { Counter } from '../../application/metrics/counter';
import type { Gauge } from '../../application/metrics/gauge';
import type { Histogram } from '../../application/metrics/histogram';
import type { Metrics } from '../../application/ports/metrics';

const NOTHING = Object.freeze({
  increment: (): void => undefined,
  record: (): void => undefined,
  set: (): void => undefined,
});

/** Measures nothing. The default until the platform binds a real adapter. */
export class NoopMetrics implements Metrics {
  counter(): Counter {
    return NOTHING;
  }

  histogram(): Histogram {
    return NOTHING;
  }

  gauge(): Gauge {
    return NOTHING;
  }
}
