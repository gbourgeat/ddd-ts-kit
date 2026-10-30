import { describe, expect, it } from 'vitest';
import {
  InMemoryLogger,
  InMemoryMetrics,
  LOG_LEVELS,
  NoopLogger,
  NoopMetrics,
  type Logger,
  type Metrics,
} from '../src';

describe('InMemoryLogger', () => {
  it('records entries as data, one per call, in order', () => {
    const logger = new InMemoryLogger();

    logger.debug('cache warmed');
    logger.info('order shipped', { context: 'shipping', durationMs: 12 });
    logger.warn('carrier slow');
    logger.error('carrier failed', { errorType: 'TimeoutError', errorCode: 'TIMEOUT' });

    expect(logger.entries.map((entry) => entry.level)).toEqual(LOG_LEVELS);

    expect(logger.entries[1]).toEqual({
      level: 'info',
      message: 'order shipped',
      fields: { context: 'shipping', durationMs: 12 },
    });
  });

  it('gives a child its fields on every entry, written to the same place', () => {
    const logger = new InMemoryLogger({ base: { service: 'shop' } });
    const child = logger.child({ context: 'billing' }).child({ correlationId: 'corr-1' });

    child.info('invoice issued', { context: 'invoicing' });

    expect(logger.entries).toEqual([
      {
        level: 'info',
        message: 'invoice issued',
        fields: { service: 'shop', context: 'invoicing', correlationId: 'corr-1' },
      },
    ]);

    logger.clear();
    expect(child.entries).toEqual([]);
  });
});

describe('NoopLogger', () => {
  it('accepts everything and writes nothing', async () => {
    const logger: Logger = new NoopLogger();

    logger.debug('ignored');
    logger.info('ignored', { context: 'billing' });
    logger.warn('ignored');
    logger.error('ignored', { errorType: 'Error' });

    expect(logger.child({ context: 'billing' })).toBe(logger);
    expect(logger.isLevelEnabled('error')).toBe(false);
    await expect(logger.flush()).resolves.toBeUndefined();
  });
});

describe('InMemoryMetrics', () => {
  it('adds up a counter, by labels', () => {
    const metrics = new InMemoryMetrics();
    const calls = metrics.counter('calls_total');

    calls.increment({ context: 'billing', outcome: 'success' });
    calls.increment({ context: 'billing', outcome: 'failure' });
    metrics.counter('calls_total').increment({ context: 'shipping', outcome: 'success' }, 3);

    expect(metrics.counterValue('calls_total')).toBe(5);
    expect(metrics.counterValue('calls_total', { context: 'billing' })).toBe(2);
    expect(metrics.counterValue('calls_total', { outcome: 'success' })).toBe(4);
    expect(metrics.counterValue('other_total')).toBe(0);
  });

  it('keeps every value a histogram observed', () => {
    const metrics = new InMemoryMetrics();

    metrics.histogram('duration_ms').record(12, { context: 'billing' });
    metrics.histogram('duration_ms').record(40, { context: 'billing' });

    expect(metrics.histogramValues('duration_ms', { context: 'billing' })).toEqual([12, 40]);
  });

  it('answers the last value of a gauge', () => {
    const metrics = new InMemoryMetrics();

    expect(metrics.gaugeValue('queue_depth')).toBeUndefined();
    metrics.gauge('queue_depth').set(4);
    metrics.gauge('queue_depth').set(2);

    expect(metrics.gaugeValue('queue_depth')).toBe(2);
  });

  it('leaves an undefined label out of the sample', () => {
    const metrics = new InMemoryMetrics();

    metrics.counter('calls_total').increment({ context: 'billing', error_code: undefined });

    expect(metrics.samples).toEqual([
      { kind: 'counter', name: 'calls_total', value: 1, labels: { context: 'billing' } },
    ]);

    metrics.clear();
    expect(metrics.samples).toEqual([]);
  });
});

describe('NoopMetrics', () => {
  it('accepts every measurement', () => {
    const metrics: Metrics = new NoopMetrics();

    metrics.counter('calls_total').increment({ context: 'billing' });
    metrics.histogram('duration_ms').record(12);
    metrics.gauge('queue_depth').set(1);

    expect(metrics.counter('calls_total')).toBe(metrics.counter('other_total'));
  });
});
