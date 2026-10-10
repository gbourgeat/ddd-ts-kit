import type { MetricLabels } from './metric-labels.js';

/** A distribution of observed values: durations, sizes. */
export interface Histogram {
  record(value: number, labels?: MetricLabels): void;
}
