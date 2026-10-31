import { metrics } from '@opentelemetry/api';
import { type DataPoint, type Histogram, MeterProvider, MetricReader } from '@opentelemetry/sdk-metrics';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openTelemetryMetrics } from '../src';

/** Reads what the instruments hold whenever the spec asks, as an exporter would on its interval. */
class ReaderOnDemand extends MetricReader {
  protected override onShutdown(): Promise<void> {
    return Promise.resolve();
  }

  protected override onForceFlush(): Promise<void> {
    return Promise.resolve();
  }
}

let reader: ReaderOnDemand;

beforeEach(() => {
  reader = new ReaderOnDemand();
  metrics.setGlobalMeterProvider(new MeterProvider({ readers: [reader] }));
});

afterEach(() => {
  metrics.disable();
});

async function pointsOf<T = number>(name: string): Promise<DataPoint<T>[]> {
  const { resourceMetrics } = await reader.collect();
  const series = resourceMetrics.scopeMetrics.flatMap((scope) => scope.metrics);

  return (series.find((metric) => metric.descriptor.name === name)?.dataPoints ?? []) as DataPoint<T>[];
}

describe('openTelemetryMetrics', () => {
  it('adds one per increment by default, and the amount given', async () => {
    const calls = openTelemetryMetrics().counter('use_case_total');

    calls.increment({ outcome: 'success' });
    calls.increment({ outcome: 'success' });
    calls.increment({ outcome: 'failure' }, 3);

    const points = await pointsOf('use_case_total');

    expect(points.map(({ attributes, value }) => ({ attributes, value }))).toEqual([
      { attributes: { outcome: 'success' }, value: 2 },
      { attributes: { outcome: 'failure' }, value: 3 },
    ]);
  });

  it('records each value of a histogram under its labels', async () => {
    const durations = openTelemetryMetrics().histogram('use_case_duration_ms');

    durations.record(12, { context: 'billing' });
    durations.record(30, { context: 'billing' });

    const [point] = await pointsOf<Histogram>('use_case_duration_ms');

    expect(point?.attributes).toEqual({ context: 'billing' });
    expect(point?.value).toMatchObject({ count: 2, sum: 42, min: 12, max: 30 });
  });

  it('keeps the last value a gauge was set to', async () => {
    const pending = openTelemetryMetrics().gauge('outbox_pending');

    pending.set(7);
    pending.set(4);

    const points = await pointsOf('outbox_pending');

    expect(points.map(({ value }) => value)).toEqual([4]);
  });

  it('feeds one series when a name is asked for twice', async () => {
    const measured = openTelemetryMetrics();

    measured.counter('dependency_call_total').increment();
    measured.counter('dependency_call_total').increment();

    expect(measured.counter('dependency_call_total')).toBe(measured.counter('dependency_call_total'));
    expect((await pointsOf('dependency_call_total')).map(({ value }) => value)).toEqual([2]);
  });

  it('leaves an undefined label out, so the series is the one without it', async () => {
    const calls = openTelemetryMetrics().counter('use_case_total');

    calls.increment({ outcome: 'success', error_code: undefined });
    calls.increment({ outcome: 'success' });

    const points = await pointsOf('use_case_total');

    expect(points.map(({ attributes, value }) => ({ attributes, value }))).toEqual([
      { attributes: { outcome: 'success' }, value: 2 },
    ]);
  });

  it('names the meter after the application when told', async () => {
    openTelemetryMetrics({ meterName: 'clinic-api', meterVersion: '1.2.3' }).counter('use_case_total').increment();

    const { resourceMetrics } = await reader.collect();

    expect(resourceMetrics.scopeMetrics.map(({ scope }) => scope)).toEqual([
      expect.objectContaining({ name: 'clinic-api', version: '1.2.3' }),
    ]);
  });

  it('measures nothing before a meter provider is registered', async () => {
    metrics.disable();

    const early = openTelemetryMetrics().counter('use_case_total');

    reader = new ReaderOnDemand();
    metrics.setGlobalMeterProvider(new MeterProvider({ readers: [reader] }));

    early.increment();

    expect(await pointsOf('use_case_total')).toEqual([]);
  });
});
