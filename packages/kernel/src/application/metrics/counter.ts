import type { MetricLabels } from './metric-labels';

/** A count that only goes up: calls, failures. */
export interface Counter {
  increment(labels?: MetricLabels, by?: number): void;
}
