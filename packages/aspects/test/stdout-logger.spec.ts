import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { CREDENTIAL_KEYS, DomainError, FixedClock, LOG_LEVELS, REDACTED, SCRUBBED_MESSAGE } from '@ddd-ts-kit/kernel';
import { StdoutLogger } from '../src';

class OrderAlreadyPaid extends DomainError {
  readonly code = 'ORDER_ALREADY_PAID';
}

const clock = new FixedClock(new Date('2026-03-01T10:00:00.000Z'));
const written = (lines: string[]): unknown[] => lines.map((line) => JSON.parse(line));

describe('StdoutLogger', () => {
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

    const logger = new StdoutLogger({
      clock,
      write: (line) => lines.push(line),
      fields: () => ({ trace_id: traceId }),
    });

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

    expect(written(lines)).toMatchObject([
      { message: 'first' },
      { message: 'second', logError: 'unserializable fields' },
    ]);
  });

  it('writes the entry without its fields when one at the top cannot be read, for a child too', () => {
    const lines: string[] = [];
    const logger = new StdoutLogger({ clock, write: (line) => lines.push(line), base: { service: 'shop' } });

    logger.info('order shipped', unreadableFields());
    logger.child(unreadableFields()).warn('carrier slow');

    expect(written(lines)).toEqual([
      { time: '2026-03-01T10:00:00.000Z', level: 'info', message: 'order shipped', logError: 'unserializable fields' },
      {
        time: '2026-03-01T10:00:00.000Z',
        level: 'warn',
        message: 'carrier slow',
        service: 'shop',
        logError: 'unserializable fields',
      },
    ]);
  });
});

describe('StdoutLogger, on credentials', () => {
  it('hides every credential key at the top of an entry and one level below, as pino and winston do', () => {
    const lines: string[] = [];
    const credentials = Object.fromEntries(CREDENTIAL_KEYS.map((key) => [key, `value-of-${key}`]));

    new StdoutLogger({ clock, write: (line) => lines.push(line) }).info('signed in', {
      ...credentials,
      headers: credentials,
      userId: 'user-1',
    });

    const hidden = Object.fromEntries(CREDENTIAL_KEYS.map((key) => [key, REDACTED]));

    expect(written(lines)).toMatchObject([{ ...hidden, headers: hidden, userId: 'user-1' }]);
    expect(lines.join('')).not.toContain('value-of-');
  });

  it('hides them whatever their case, in the fields of a line, of a child and read at each entry', () => {
    const lines: string[] = [];

    const logger = new StdoutLogger({
      clock,
      write: (line) => lines.push(line),
      base: { Secret: 'base-secret' },
      fields: () => ({ ID_TOKEN: 'ambient-secret' }),
    });

    logger.child({ ClientSecret: 'bound-secret' }).info('signed in', {
      AUTHORIZATION: 'Bearer line-secret',
      headers: { Authorization: 'Bearer nested-secret', 'X-Api-Key': 'nested-secret', accept: 'text/html' },
    });

    expect(written(lines)).toMatchObject([
      {
        Secret: REDACTED,
        ID_TOKEN: REDACTED,
        ClientSecret: REDACTED,
        AUTHORIZATION: REDACTED,
        headers: { Authorization: REDACTED, 'X-Api-Key': REDACTED, accept: 'text/html' },
      },
    ]);

    expect(lines.join('')).not.toMatch(/-secret/);
  });

  it('leaves what lies deeper, and the fields it was given, as they are', () => {
    const lines: string[] = [];
    const request = { headers: { authorization: 'Bearer abc' } };

    new StdoutLogger({ clock, write: (line) => lines.push(line) }).info('received', {
      request,
      headers: request.headers,
      users: [{ password: 'in-a-list' }],
    });

    expect(written(lines)).toMatchObject([
      {
        request: { headers: { authorization: 'Bearer abc' } },
        headers: { authorization: REDACTED },
        users: [{ password: 'in-a-list' }],
      },
    ]);

    expect(request.headers.authorization).toBe('Bearer abc');
  });
});

describe('StdoutLogger, on errors, levels and flush', () => {
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

  it('writes each line on the stream it is given, and a write of the project wins over it', () => {
    const stream = new PassThrough();
    const lines: string[] = [];

    new StdoutLogger({ clock, stream }).info('on the stream');
    new StdoutLogger({ clock, stream, write: (line) => lines.push(line) }).info('on the write');

    expect(String(stream.read())).toContain('"message":"on the stream"');
    expect(lines).toHaveLength(1);
  });

  it('resolves its flush when its stream throws, as a redirected standard output does on a full disk', async () => {
    const stream = {
      write(): boolean {
        throw new Error('ENOSPC');
      },
    };

    await expect(new StdoutLogger({ stream }).flush()).resolves.toBeUndefined();
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

function unreadableFields(): { readonly total: number } {
  return {
    get total(): number {
      throw new Error('unreadable');
    },
  };
}
