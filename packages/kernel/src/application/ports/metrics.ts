import type { Counter } from '../metrics/counter';
import type { Gauge } from '../metrics/gauge';
import type { Histogram } from '../metrics/histogram';

/** Asking twice for the same name feeds the same series. */
export abstract class Metrics {
  static {
    Object.defineProperty(this, 'tokenKey', { value: 'kernel.Metrics' });
  }

  abstract counter(name: string): Counter;

  abstract histogram(name: string): Histogram;

  abstract gauge(name: string): Gauge;
}
