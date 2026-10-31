import type { Counter, Gauge, Histogram, MetricLabels, Metrics } from '@ddd-ts-kit/kernel';
import { type Attributes, type Meter, metrics } from '@opentelemetry/api';

export interface OpenTelemetryMetricsOptions {
  /** Name of the meter, the instrumentation scope of every series. Default `@ddd-ts-kit/tracing`. */
  readonly meterName?: string;
  readonly meterVersion?: string;
}

/**
 * The kernel `Metrics` port on the OpenTelemetry metrics API: a counter, a histogram and a
 * synchronous gauge per name, created once. The meter is taken from the global meter provider
 * when this is called, so call it after `initTracing`: before, the API answers a meter that
 * measures nothing, and so does every instrument it made.
 */
export function openTelemetryMetrics(options: OpenTelemetryMetricsOptions = {}): Metrics {
  return new OpenTelemetryMetrics(metrics.getMeter(options.meterName ?? '@ddd-ts-kit/tracing', options.meterVersion));
}

class OpenTelemetryMetrics implements Metrics {
  private readonly counters = new Map<string, Counter>();

  private readonly histograms = new Map<string, Histogram>();

  private readonly gauges = new Map<string, Gauge>();

  constructor(private readonly meter: Meter) {}

  counter(name: string): Counter {
    return once(this.counters, name, () => {
      const instrument = this.meter.createCounter(name);

      return { increment: (labels, by = 1) => instrument.add(by, attributesOf(labels)) };
    });
  }

  histogram(name: string): Histogram {
    return once(this.histograms, name, () => {
      const instrument = this.meter.createHistogram(name);

      return { record: (value, labels) => instrument.record(value, attributesOf(labels)) };
    });
  }

  gauge(name: string): Gauge {
    return once(this.gauges, name, () => {
      const instrument = this.meter.createGauge(name);

      return { set: (value, labels) => instrument.record(value, attributesOf(labels)) };
    });
  }
}

function once<T>(made: Map<string, T>, name: string, make: () => T): T {
  const existing = made.get(name) ?? make();

  made.set(name, existing);

  return existing;
}

/** An undefined label is left out, as the port says: the SDK would count it as another series. */
function attributesOf(labels: MetricLabels = {}): Attributes {
  return Object.fromEntries(Object.entries(labels).filter(([, value]) => value !== undefined));
}
