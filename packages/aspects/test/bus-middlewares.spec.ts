import { describe, expect, it } from 'vitest';
import {
  Command,
  FixedClock,
  InMemoryCommandBus,
  InMemoryLogger,
  InMemoryMetrics,
  Query,
  InMemoryQueryBus,
} from '@ddd-ts-kit/kernel';
import { loggingMiddleware, metricsMiddleware } from '../src';
import { PairNotQuoted } from './support/pair-not-quoted';

class ShipOrder extends Command<string> {
  constructor(readonly orderId: string) {
    super();
  }
}

class FindOrder extends Query<string> {}

describe('loggingMiddleware and metricsMiddleware', () => {
  it('observe every command by the name of its class, never its content', async () => {
    const logger = new InMemoryLogger();
    const metrics = new InMemoryMetrics();
    const clock = new FixedClock(new Date('2026-03-01T10:00:00.000Z'));

    const bus = new InMemoryCommandBus()
      .use(loggingMiddleware(logger, { clock }))
      .use(metricsMiddleware(metrics, { clock }))
      .register(ShipOrder, {
        execute: async (command) => {
          clock.advance(15);

          return `shipped ${command.orderId}`;
        },
      });

    expect(await bus.execute(new ShipOrder('order-4111'))).toBe('shipped order-4111');

    const fields = { message: 'ShipOrder', messageKind: 'command' };

    expect(logger.entries).toEqual([
      { level: 'debug', message: 'command ShipOrder started', fields },
      { level: 'info', message: 'command ShipOrder succeeded', fields: { ...fields, durationMs: 15 } },
    ]);

    expect(metrics.histogramValues('use_case_duration_ms', { message: 'ShipOrder', kind: 'command' })).toEqual([15]);
    expect(JSON.stringify([logger.entries, metrics.samples])).not.toMatch(/4111/);
  });

  it('observe a refused query as a failure with its code', async () => {
    const logger = new InMemoryLogger();
    const metrics = new InMemoryMetrics();

    const bus = new InMemoryQueryBus()
      .use(loggingMiddleware(logger))
      .use(metricsMiddleware(metrics, { name: 'queries' }))
      .register(FindOrder, {
        execute: async () => {
          throw new PairNotQuoted();
        },
      });

    await expect(bus.execute(new FindOrder())).rejects.toBeInstanceOf(PairNotQuoted);

    expect(logger.entries.at(-1)).toMatchObject({
      level: 'warn',
      message: 'query FindOrder failed',
      fields: { errorCode: 'PAIR_NOT_QUOTED' },
    });

    expect(metrics.counterValue('queries_total', { outcome: 'failure', error_code: 'PAIR_NOT_QUOTED' })).toBe(1);
  });
});
