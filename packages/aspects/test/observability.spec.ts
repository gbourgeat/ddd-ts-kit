import { describe, expect, it } from 'vitest';
import { Command, FixedClock, InMemoryCommandBus, InMemoryLogger, InMemoryMetrics, Query, InMemoryQueryBus } from '@ddd-ts-kit/kernel';
import {
  AspectRuntimeError,
  StdoutLogger,
  compose,
  defineAspect,
  logged,
  loggingMiddleware,
  metricsMiddleware,
  timed,
} from '../src/index.js';
import { createAspectFakes, withAspectRuntime } from '../src/testing.js';
import { PairNotQuoted, QuoteGateway, Unreachable } from './support/adapters.js';

const SECRETS = /4111|10\.0\.0\.7|EUR-USD|1\.08/;

/** Makes the call inside last a known time on the fake clock. */
function lasting(clock: FixedClock, durationMs: number) {
  return defineAspect(() => async ({ proceed }) => {
    clock.advance(durationMs);
    return proceed();
  });
}

describe('logged', () => {
  it('writes a start and a success entry with class, method, kind, context and duration', async () => {
    const fakes = createAspectFakes();
    const gateway = compose(logged(), lasting(fakes.clock, 40))(new QuoteGateway(), {
      kind: 'external',
      context: 'pricing',
    });

    await withAspectRuntime(fakes, () => gateway.quote('EUR-USD'));

    const subject = { class: 'QuoteGateway', method: 'quote', kind: 'external', context: 'pricing' };
    expect(fakes.logger.entries).toEqual([
      { level: 'debug', message: 'QuoteGateway.quote started', fields: subject },
      { level: 'info', message: 'QuoteGateway.quote succeeded', fields: { ...subject, durationMs: 40 } },
    ]);
  });

  it('writes a fault as an error with its class and code, and rethrows it untouched', async () => {
    const fakes = createAspectFakes();
    const fault = new Unreachable();
    const gateway = logged()(new QuoteGateway().failNext(fault));

    await expect(withAspectRuntime(fakes, () => gateway.quote('EUR-USD'))).rejects.toBe(fault);

    expect(fakes.logger.entries.at(-1)).toEqual({
      level: 'error',
      message: 'QuoteGateway.quote failed',
      fields: { class: 'QuoteGateway', method: 'quote', durationMs: 0, errorType: 'Unreachable', errorCode: 'ECONNRESET' },
    });
  });

  it('writes a business refusal as a warning with the code of the domain error', async () => {
    const fakes = createAspectFakes();
    const gateway = logged()(new QuoteGateway().failNext(new PairNotQuoted()));

    await expect(withAspectRuntime(fakes, () => gateway.quote('EUR-USD'))).rejects.toBeInstanceOf(PairNotQuoted);

    expect(fakes.logger.entries.at(-1)).toMatchObject({
      level: 'warn',
      fields: { errorType: 'PairNotQuoted', errorCode: 'PAIR_NOT_QUOTED' },
    });
  });

  it('never records arguments, results or error messages', async () => {
    const fakes = createAspectFakes();
    const gateway = logged()(new QuoteGateway());

    await withAspectRuntime(fakes, async () => {
      await gateway.quote('EUR-USD');
      await gateway.failNext(new Unreachable()).quote('EUR-USD').catch(() => undefined);
      await gateway.failNext(new PairNotQuoted()).quote('EUR-USD').catch(() => undefined);
    });

    expect(JSON.stringify(fakes.logger.entries)).not.toMatch(SECRETS);
  });

  it('takes its level, its fields and its logger from the options', async () => {
    const logger = new InMemoryLogger();
    let region = 'eu';
    const gateway = logged({ logger, level: 'debug', fields: () => ({ region }) })(new QuoteGateway());

    await gateway.quote('EUR-USD');
    region = 'us';
    await gateway.quote('EUR-USD');

    expect(logger.entries.map((entry) => [entry.level, entry.fields.region])).toEqual([
      ['debug', 'eu'],
      ['debug', 'eu'],
      ['debug', 'us'],
      ['debug', 'us'],
    ]);
  });

  it('does not let a failing logger change the outcome of the call', async () => {
    const broken = new InMemoryLogger();
    broken.info = () => {
      throw new Error('disk full');
    };
    broken.debug = broken.info;

    expect(await logged({ logger: broken })(new QuoteGateway()).quote('EUR-USD')).toMatchObject({ rate: 1.08 });
  });

  it('says which collaborator is missing when no runtime provides it', async () => {
    const gateway = logged()(new QuoteGateway());

    await expect(withAspectRuntime({}, () => gateway.quote('EUR-USD'))).rejects.toBeInstanceOf(AspectRuntimeError);
    await expect(withAspectRuntime({}, () => gateway.quote('EUR-USD'))).rejects.toThrow(/installAspectRuntime\(\{ logger \}\)/);
  });
});

describe('timed', () => {
  it('records the duration and counts the outcome, labelled by what was called', async () => {
    const fakes = createAspectFakes();
    const gateway = compose(timed(), lasting(fakes.clock, 25))(new QuoteGateway(), {
      kind: 'gateway',
      context: 'pricing',
    });

    await withAspectRuntime(fakes, () => gateway.quote('EUR-USD'));

    const labels = { class: 'QuoteGateway', method: 'quote', kind: 'gateway', context: 'pricing', outcome: 'success' };
    expect(fakes.metrics.samples).toEqual([
      { kind: 'histogram', name: 'dependency_call_duration_ms', value: 25, labels },
      { kind: 'counter', name: 'dependency_call_total', value: 1, labels },
    ]);
  });

  it('counts a failure with its error code and nothing else about it', async () => {
    const fakes = createAspectFakes();
    const gateway = timed({ name: 'quotes' })(new QuoteGateway().failNext(new PairNotQuoted(), new TypeError('x')));

    await withAspectRuntime(fakes, async () => {
      await gateway.quote('EUR-USD').catch(() => undefined);
      await gateway.quote('EUR-USD').catch(() => undefined);
    });

    expect(fakes.metrics.counterValue('quotes_total', { outcome: 'failure', error_code: 'PAIR_NOT_QUOTED' })).toBe(1);
    expect(fakes.metrics.counterValue('quotes_total', { outcome: 'failure' })).toBe(2);
    expect(fakes.metrics.histogramValues('quotes_duration_ms', { outcome: 'failure' })).toEqual([0, 0]);
    expect(JSON.stringify(fakes.metrics.samples)).not.toMatch(SECRETS);
  });
});

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

describe('StdoutLogger', () => {
  const clock = new FixedClock(new Date('2026-03-01T10:00:00.000Z'));
  const written = (lines: string[]): unknown[] => lines.map((line) => JSON.parse(line));

  it('writes one JSON line per entry: time, level, message, then the fields', () => {
    const lines: string[] = [];
    const logger = new StdoutLogger({ clock, write: (line) => lines.push(line), base: { service: 'shop' } });

    logger.info('order shipped', { context: 'shipping', shippedAt: new Date('2026-03-01T09:59:00.000Z') });

    expect(lines[0]).toBe(
      '{"time":"2026-03-01T10:00:00.000Z","level":"info","message":"order shipped","service":"shop","context":"shipping","shippedAt":"2026-03-01T09:59:00.000Z"}\n',
    );
  });

  it('adds the correlation fields of the work in progress to every entry', () => {
    const lines: string[] = [];
    let traceId = 'trace-1';
    const logger = new StdoutLogger({ clock, write: (line) => lines.push(line), fields: () => ({ trace_id: traceId }) });

    logger.warn('carrier slow');
    traceId = 'trace-2';
    logger.child({ context: 'shipping' }).error('carrier failed', { errorCode: 'TIMEOUT' });

    expect(written(lines)).toMatchObject([
      { level: 'warn', trace_id: 'trace-1' },
      { level: 'error', trace_id: 'trace-2', context: 'shipping', errorCode: 'TIMEOUT' },
    ]);
  });

  it('writes nothing below its level', () => {
    const lines: string[] = [];
    const logger = new StdoutLogger({ clock, write: (line) => lines.push(line), level: 'warn' });

    logger.debug('a');
    logger.info('b');
    logger.warn('c');
    logger.error('d');

    expect(written(lines)).toMatchObject([{ message: 'c' }, { message: 'd' }]);
  });

  it('does not let fields forge the time, the level or the message', () => {
    const lines: string[] = [];
    const logger = new StdoutLogger({ clock, write: (line) => lines.push(line) });

    logger.info('real', { level: 'error', message: 'forged', time: 'yesterday' });

    expect(written(lines)).toEqual([{ time: '2026-03-01T10:00:00.000Z', level: 'info', message: 'real' }]);
  });

  it('still writes the entry when its fields cannot be read or serialized', () => {
    const lines: string[] = [];
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const logger = new StdoutLogger({
      clock,
      write: (line) => lines.push(line),
      fields: () => {
        throw new Error('no active span');
      },
    });

    logger.info('first');
    logger.info('second', circular as never);

    expect(written(lines)).toMatchObject([{ message: 'first' }, { message: 'second', logError: 'unserializable fields' }]);
  });
});
