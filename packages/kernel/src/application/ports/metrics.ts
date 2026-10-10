import type { Counter } from '../metrics/counter.js';
import type { Gauge } from '../metrics/gauge.js';
import type { Histogram } from '../metrics/histogram.js';

/** Asking twice for the same name feeds the same series. */
export abstract class Metrics {
  static {
    Object.defineProperty(this, 'tokenKey', { value: 'kernel.Metrics' });
  }

  abstract counter(name: string): Counter;

  abstract histogram(name: string): Histogram;

  abstract gauge(name: string): Gauge;
}
