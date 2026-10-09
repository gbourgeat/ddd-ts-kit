/**
 * Dimensions of a measurement. Values are strings from a small, closed set: never an
 * identifier, never user input. An undefined label is left out. A project declares its
 * well-known labels by declaration merging:
 *
 *     declare module '@ddd-ts-kit/kernel' {
 *       interface MetricLabels { region?: 'eu' | 'us' | undefined }
 *     }
 */
export interface MetricLabels {
  /** Bounded context the measurement is about. */
  context?: string | undefined;
  outcome?: 'success' | 'failure' | undefined;
  [label: string]: string | undefined;
}

/** A count that only goes up: calls, failures. */
export interface Counter {
  increment(labels?: MetricLabels, by?: number): void;
}

/** A distribution of observed values: durations, sizes. */
export interface Histogram {
  record(value: number, labels?: MetricLabels): void;
}

/** A value that goes up and down: queue depth, circuit state. */
export interface Gauge {
  set(value: number, labels?: MetricLabels): void;
}

/** Asking twice for the same name feeds the same series. */
export interface Metrics {
  counter(name: string): Counter;
  histogram(name: string): Histogram;
  gauge(name: string): Gauge;
}
