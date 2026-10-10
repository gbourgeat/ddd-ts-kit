import type { MetricLabels } from './metric-labels.js';

/** A value that goes up and down: queue depth, circuit state. */
export interface Gauge {
  set(value: number, labels?: MetricLabels): void;
}
