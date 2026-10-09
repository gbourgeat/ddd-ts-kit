import type { Counter, Gauge, Histogram, MetricLabels, Metrics } from '../application/metrics.js';

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

export type MetricKind = 'counter' | 'histogram' | 'gauge';

export interface MetricSample {
  readonly kind: MetricKind;
  readonly name: string;
  readonly value: number;
  readonly labels: Readonly<Record<string, string>>;
}

/**
 * The fake: every measurement is a sample a test asserts. The readers take a subset of labels:
 * a sample matches when it carries at least those.
 */
export class InMemoryMetrics implements Metrics {
  readonly samples: MetricSample[] = [];

  counter(name: string): Counter {
    return {
      increment: (labels, by = 1) => {
        this.#record({ kind: 'counter', name, value: by }, labels);
      },
    };
  }

  histogram(name: string): Histogram {
    return {
      record: (value, labels) => {
        this.#record({ kind: 'histogram', name, value }, labels);
      },
    };
  }

  gauge(name: string): Gauge {
    return {
      set: (value, labels) => {
        this.#record({ kind: 'gauge', name, value }, labels);
      },
    };
  }

  counterValue(name: string, labels: MetricLabels = {}): number {
    return this.#matching('counter', name, labels).reduce((sum, sample) => sum + sample.value, 0);
  }

  histogramValues(name: string, labels: MetricLabels = {}): number[] {
    return this.#matching('histogram', name, labels).map((sample) => sample.value);
  }

  /** The last value set, `undefined` when the gauge was never set. */
  gaugeValue(name: string, labels: MetricLabels = {}): number | undefined {
    return this.#matching('gauge', name, labels).at(-1)?.value;
  }

  clear(): void {
    this.samples.length = 0;
  }

  #record(sample: Omit<MetricSample, 'labels'>, labels: MetricLabels = {}): void {
    this.samples.push({ ...sample, labels: definedLabels(labels) });
  }

  #matching(kind: MetricKind, name: string, labels: MetricLabels): MetricSample[] {
    const wanted = Object.entries(definedLabels(labels));
    return this.samples.filter(
      (sample) =>
        sample.kind === kind &&
        sample.name === name &&
        wanted.every(([label, value]) => sample.labels[label] === value),
    );
  }
}

function definedLabels(labels: MetricLabels): Record<string, string> {
  const defined: Record<string, string> = {};
  for (const [label, value] of Object.entries(labels)) {
    if (value !== undefined) defined[label] = value;
  }
  return defined;
}
