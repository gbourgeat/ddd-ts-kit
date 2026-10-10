import type { MetricLabels } from './metric-labels.js';

/** A count that only goes up: calls, failures. */
export interface Counter {
  increment(labels?: MetricLabels, by?: number): void;
}
