import { describe, expect, it } from 'vitest';
import { FixedClock } from '@ddd-ts-kit/kernel';
import { StdoutLogger } from '../src/index.js';

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
