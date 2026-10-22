import { describe, expect, it } from 'vitest';
import {
  DomainError,
  InMemoryLogger,
  NoopLogger,
  SCRUBBED_MESSAGE,
  UNWRITABLE_FIELDS,
  describeError,
  describeErrorFields,
  errorReportOf,
  identifyError,
  type LogFields,
  type Logger,
} from '../src';

declare module '../src/index.js' {
  interface LogFields {
    error?: Error;
  }
}

class OrderAlreadyPaid extends DomainError {
  readonly code = 'ORDER_ALREADY_PAID';
}

describe('describeError', () => {
  it('describes an error as its class, its message and its own stack, without a code', () => {
    const description = describeError(new RangeError('weight out of range'));

    expect(Object.keys(description)).toEqual(['type', 'message', 'stack']);
    expect(description).toMatchObject({ type: 'RangeError', message: 'weight out of range' });
    expect(description.stack).toMatch(/^RangeError: weight out of range\n\s+at /);
  });

  it('carries the code of a DomainError, and no code a fault happens to hold', () => {
    const fault = Object.assign(new Error('socket closed'), { code: 'ECONNRESET' });

    expect(describeError(new OrderAlreadyPaid('Order order-1 is already paid'))).toMatchObject({
      type: 'OrderAlreadyPaid',
      code: 'ORDER_ALREADY_PAID',
      message: 'Order order-1 is already paid',
    });

    expect(describeError(fault)).not.toHaveProperty('code');
  });

  it('describes each cause once, and leaves a cause that is not an error out', () => {
    const failure = new Error('ledger unavailable', { cause: new TypeError('socket closed', { cause: 'ECONNRESET' }) });
    const description = describeError(failure);

    expect(description.cause).toMatchObject({ type: 'TypeError', message: 'socket closed' });
    expect(description.cause).not.toHaveProperty('cause');
    expect(description.stack).not.toContain('socket closed');
  });

  it('stops eight errors deep in a chain of causes that loops', () => {
    const failure = new Error('first');

    failure.cause = new Error('second', { cause: failure });

    expect(JSON.stringify(describeError(failure)).match(/"message":"first"/g)).toHaveLength(4);
  });

  it('replaces the message of an unexpected error when it scrubs, and drops the line of the stack that repeats it', () => {
    const refusal = new OrderAlreadyPaid('Order order-1 is already paid', {
      cause: new Error('duplicate key (ada@example.org)'),
    });

    const description = describeError(refusal, { scrubMessages: true });

    expect(description).toMatchObject({
      message: 'Order order-1 is already paid',
      cause: { type: 'Error', message: SCRUBBED_MESSAGE },
    });

    expect(description.cause?.stack).toMatch(/^\s+at /);
    expect(JSON.stringify(description)).not.toContain('ada@example.org');
  });

  it('gives no stack to a scrubbed error whose stack holds no frame', () => {
    const failure = new Error('row (ada@example.org) refused');

    failure.stack = 'Error: row (ada@example.org) refused';

    expect(describeError(failure, { scrubMessages: true })).toEqual({ type: 'Error', message: SCRUBBED_MESSAGE });
  });
});

describe('describeErrorFields', () => {
  it('describes the errors directly under a key, in a copy, and leaves the rest as it is', () => {
    const failure = new RangeError('weight out of range');
    const fields: LogFields = { error: failure, orderId: 'order-1', attempt: { last: failure } };
    const written = describeErrorFields(fields);

    expect(written).toMatchObject({
      error: { type: 'RangeError', message: 'weight out of range' },
      orderId: 'order-1',
    });

    expect(written.attempt).toBe(fields.attempt);
    expect(fields.error).toBe(failure);
  });
});

describe('identifyError', () => {
  it('names the class and the short code, never the message', () => {
    expect(identifyError(new OrderAlreadyPaid('Order order-1 is already paid'))).toEqual({
      errorType: 'OrderAlreadyPaid',
      errorCode: 'ORDER_ALREADY_PAID',
    });

    expect(identifyError(Object.assign(new Error('socket closed'), { code: 'ECONNRESET' }))).toEqual({
      errorType: 'Error',
      errorCode: 'ECONNRESET',
    });

    expect(identifyError(Object.assign(new Error('refused'), { code: 'a code that quotes ada@example.org' }))).toEqual({
      errorType: 'Error',
    });

    expect(identifyError('thrown string')).toEqual({ errorType: 'string' });
  });

  it('gives its code to the report of the error', () => {
    expect(errorReportOf(new OrderAlreadyPaid('paid'), { origin: 'command', operation: 'PayOrder' }).errorCode).toBe(
      'ORDER_ALREADY_PAID',
    );
  });
});

describe('InMemoryLogger', () => {
  it('records an error as its description, scrubbed when asked', () => {
    const logger = new InMemoryLogger();
    const scrubbing = new InMemoryLogger({ scrubMessages: true });
    const error = new Error('row (ada@example.org) refused');

    logger.error('payment failed', { error });
    scrubbing.child({ context: 'billing' }).error('payment failed', { error });

    expect(logger.entries[0]?.fields.error).toMatchObject({ type: 'Error', message: 'row (ada@example.org) refused' });

    expect(scrubbing.entries[0]?.fields).toMatchObject({
      context: 'billing',
      error: { type: 'Error', message: SCRUBBED_MESSAGE },
    });
  });

  it('records from the level it is given, and says so', () => {
    const logger = new InMemoryLogger({ level: 'warn' });

    logger.info('order shipped');
    logger.child({ context: 'shipping' }).warn('carrier slow');

    expect(logger.entries.map((entry) => entry.message)).toEqual(['carrier slow']);
    expect([logger.isLevelEnabled('info'), logger.isLevelEnabled('warn')]).toEqual([false, true]);
  });

  it('reads the fields of the work in progress at each entry, under those of the entry', () => {
    let correlationId = 'request-1';
    const logger = new InMemoryLogger({ fields: () => ({ correlationId, tenantId: 'acme' }) });

    logger.info('order placed');
    correlationId = 'request-2';
    logger.info('replayed', { tenantId: 'globex' });

    expect(logger.entries.map((entry) => entry.fields)).toEqual([
      { correlationId: 'request-1', tenantId: 'acme' },
      { correlationId: 'request-2', tenantId: 'globex' },
    ]);
  });

  it('records the entry without its fields when one of them cannot be read, for a child too', () => {
    const logger = new InMemoryLogger({ base: { service: 'shop' } });

    logger.info('order shipped', {
      get total(): number {
        throw new Error('unreadable');
      },
    });

    logger
      .child({
        get total(): number {
          throw new Error('unreadable');
        },
      })
      .warn('carrier slow');

    expect(logger.entries.map((entry) => entry.fields)).toEqual([
      UNWRITABLE_FIELDS,
      { service: 'shop', ...UNWRITABLE_FIELDS },
    ]);
  });

  it('resolves its flush and keeps recording', async () => {
    const logger = new InMemoryLogger();

    await expect(logger.flush()).resolves.toBeUndefined();
    logger.info('logged after the flush');

    expect(logger.entries).toHaveLength(1);
  });
});

describe('NoopLogger', () => {
  it('says it writes no level, and resolves its flush', async () => {
    const logger: Logger = new NoopLogger();

    expect(logger.isLevelEnabled('error')).toBe(false);
    await expect(logger.flush()).resolves.toBeUndefined();
  });
});
