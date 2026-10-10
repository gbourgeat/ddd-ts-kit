import type { Counter } from '../../application/metrics/counter.js';
import type { Gauge } from '../../application/metrics/gauge.js';
import type { Histogram } from '../../application/metrics/histogram.js';
import type { MetricLabels } from '../../application/metrics/metric-labels.js';
import type { Metrics } from '../../application/ports/metrics.js';
import type { MetricKind, MetricSample } from './metric-sample.js';

/**
 * The fake: every measurement is a sample a test asserts. The readers take a subset of labels:
 * a sample matches when it carries at least those.
 */
export class InMemoryMetrics implements Metrics {
  readonly samples: MetricSample[] = [];

  counter(name: string): Counter {
    return {
      increment: (labels, by = 1) => {
        this.record({ kind: 'counter', name, value: by }, labels);
      },
    };
  }

  histogram(name: string): Histogram {
    return {
      record: (value, labels) => {
        this.record({ kind: 'histogram', name, value }, labels);
      },
    };
  }

  gauge(name: string): Gauge {
    return {
      set: (value, labels) => {
        this.record({ kind: 'gauge', name, value }, labels);
      },
    };
  }

  counterValue(name: string, labels: MetricLabels = {}): number {
    return this.matching('counter', name, labels).reduce((sum, sample) => sum + sample.value, 0);
  }

  histogramValues(name: string, labels: MetricLabels = {}): number[] {
    return this.matching('histogram', name, labels).map((sample) => sample.value);
  }

  /** The last value set, `undefined` when the gauge was never set. */
  gaugeValue(name: string, labels: MetricLabels = {}): number | undefined {
    return this.matching('gauge', name, labels).at(-1)?.value;
  }

  clear(): void {
    this.samples.length = 0;
  }

  private record(sample: Omit<MetricSample, 'labels'>, labels: MetricLabels = {}): void {
    this.samples.push({ ...sample, labels: definedLabels(labels) });
  }

  private matching(kind: MetricKind, name: string, labels: MetricLabels): MetricSample[] {
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
    if (value !== undefined) {
      defined[label] = value;
    }
  }

  return defined;
}
