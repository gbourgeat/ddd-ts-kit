import { describe, expect, it } from 'vitest';
import { DomainError, FixedClock, LOG_LEVELS, SCRUBBED_MESSAGE } from '@ddd-ts-kit/kernel';
import { StdoutLogger } from '../src/index.js';

class OrderAlreadyPaid extends DomainError {
  readonly code = 'ORDER_ALREADY_PAID';
}

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

  it('writes the entry without its fields when one at the top cannot be read, for a child too', () => {
    const lines: string[] = [];
    const logger = new StdoutLogger({ clock, write: (line) => lines.push(line), base: { service: 'shop' } });

    logger.info('order shipped', { get total(): number { throw new Error('unreadable'); } });
    logger.child({ get total(): number { throw new Error('unreadable'); } }).warn('carrier slow');

    expect(written(lines)).toEqual([
      { time: '2026-03-01T10:00:00.000Z', level: 'info', message: 'order shipped', logError: 'unserializable fields' },
      { time: '2026-03-01T10:00:00.000Z', level: 'warn', message: 'carrier slow', service: 'shop', logError: 'unserializable fields' },
    ]);
  });

  it('writes an error passed as a field as its description, with the code of a DomainError', () => {
    const lines: string[] = [];
    const logger = new StdoutLogger({ clock, write: (line) => lines.push(line) });
    const error = new OrderAlreadyPaid('Order order-1 is already paid', { cause: new TypeError('socket closed') });

    logger.error('payment failed', { error });

    expect(written(lines)).toMatchObject([
      {
        error: {
          type: 'OrderAlreadyPaid',
          code: 'ORDER_ALREADY_PAID',
          message: 'Order order-1 is already paid',
          stack: expect.stringMatching(/^OrderAlreadyPaid: Order order-1 is already paid\n\s+at /),
          cause: { type: 'TypeError', message: 'socket closed' },
        },
      },
    ]);
  });

  it('replaces the message of an unexpected error with scrubMessages, for a child too', () => {
    const lines: string[] = [];
    const logger = new StdoutLogger({ clock, write: (line) => lines.push(line), scrubMessages: true });

    logger.child({ context: 'billing' }).error('insert failed', { error: new Error('row (ada@example.org) refused') });

    expect(lines.join('')).not.toContain('ada@example.org');
    expect(written(lines)).toMatchObject([{ context: 'billing', error: { type: 'Error', message: SCRUBBED_MESSAGE } }]);
  });

  it('says which levels it writes: from info by default, from its level otherwise, for a child too', () => {
    const quiet = new StdoutLogger({ level: 'error', write: () => undefined }).child({ context: 'billing' });

    expect(LOG_LEVELS.filter((level) => new StdoutLogger().isLevelEnabled(level))).toEqual(['info', 'warn', 'error']);
    expect(LOG_LEVELS.filter((level) => quiet.isLevelEnabled(level))).toEqual(['error']);
  });

  it('resolves its flush, on the standard output and on a write of the project, and stays usable', async () => {
    const lines: string[] = [];
    const logger = new StdoutLogger({ clock, write: (line) => lines.push(line) });

    await expect(new StdoutLogger({ level: 'error' }).flush()).resolves.toBeUndefined();
    await expect(logger.flush()).resolves.toBeUndefined();
    logger.info('logged after the flush');

    expect(lines).toHaveLength(1);
  });
});
