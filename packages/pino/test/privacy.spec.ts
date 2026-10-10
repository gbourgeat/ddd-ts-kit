import { describe, expect, it } from 'vitest';
import { CREDENTIAL_KEYS, REDACTED, SCRUBBED_MESSAGE } from '@ddd-ts-kit/kernel';
import { pino } from 'pino';
import { PinoLogger, createPinoLogger, credentialRedaction } from '../src/index.js';
import { MemorySink } from './support/memory-sink.js';
import { OrderAlreadyPaid } from './support/order-already-paid.js';

describe('redaction', () => {
  it('hides every credential key at the top of a line and one level below', () => {
    const sink = new MemorySink();
    const credentials = Object.fromEntries(CREDENTIAL_KEYS.map((key) => [key, `value-of-${key}`]));

    createPinoLogger({ destination: sink.stream }).info('signed in', {
      ...credentials,
      headers: credentials,
      userId: 'user-1',
    });

    const [line] = sink.records();
    const hidden = Object.fromEntries(CREDENTIAL_KEYS.map((key) => [key, REDACTED]));

    expect(line).toMatchObject({ ...hidden, headers: hidden, userId: 'user-1' });
    expect(sink.text()).not.toContain('value-of-');
  });

  it('hides them in the fields of a child and in the fields read at each line', () => {
    const sink = new MemorySink();

    const logger = createPinoLogger({
      destination: sink.stream,
      fields: () => ({ token: 'ambient-secret', correlationId: 'request-1' }),
    });

    logger.child({ session: { cookie: 'bound-secret', id: 'session-1' } }).info('signed in');

    expect(sink.records()).toMatchObject([
      { token: REDACTED, correlationId: 'request-1', session: { cookie: REDACTED, id: 'session-1' } },
    ]);

    expect(sink.text()).not.toMatch(/ambient-secret|bound-secret/);
  });

  it('hides the keys the project adds to the list', () => {
    const sink = new MemorySink();

    createPinoLogger({ destination: sink.stream, redact: ['iban'] }).info('transfer', {
      iban: 'FR76',
      bank: { iban: 'FR76', password: 'p' },
    });

    expect(sink.records()).toMatchObject([{ iban: REDACTED, bank: { iban: REDACTED, password: REDACTED } }]);
  });

  it('leaves what lies deeper, and the fields it was given, as they are', () => {
    const sink = new MemorySink();
    const request = { headers: { authorization: 'Bearer abc' } };
    const fields = { request, headers: request.headers };

    createPinoLogger({ destination: sink.stream }).info('received', fields);

    expect(sink.records()).toMatchObject([
      { request: { headers: { authorization: 'Bearer abc' } }, headers: { authorization: REDACTED } },
    ]);

    expect(request.headers.authorization).toBe('Bearer abc');
  });

  it('gives the same redaction to an instance the project configures itself', () => {
    const sink = new MemorySink();
    const instance = pino({ redact: credentialRedaction([...CREDENTIAL_KEYS, 'iban']) }, sink.stream);

    new PinoLogger(instance).info('transfer', { iban: 'FR76', owner: { password: 'p' } });

    expect(sink.records()).toMatchObject([{ iban: REDACTED, owner: { password: REDACTED } }]);
  });
});

describe('an error passed as a field', () => {
  it('is written as its class, its message and its stack', () => {
    const sink = new MemorySink();

    createPinoLogger({ destination: sink.stream }).error('carrier failed', {
      error: new RangeError('weight out of range'),
    });

    const [line] = sink.records();

    expect(line?.error).toMatchObject({ type: 'RangeError', message: 'weight out of range' });
    expect(line?.error).toHaveProperty('stack', expect.stringMatching(/^RangeError: weight out of range\n\s+at /));
    expect(line?.error).not.toHaveProperty('code');
  });

  it('carries the code of a DomainError', () => {
    const sink = new MemorySink();

    createPinoLogger({ destination: sink.stream }).warn('payment refused', { error: new OrderAlreadyPaid('order-1') });

    expect(sink.records()).toMatchObject([
      { error: { type: 'OrderAlreadyPaid', code: 'ORDER_ALREADY_PAID', message: 'Order order-1 is already paid' } },
    ]);
  });

  it('writes each error of a cause chain once, under the key pino serializes by default too', () => {
    const sink = new MemorySink();

    const failure = new Error('ledger unavailable', {
      cause: new TypeError('socket closed', { cause: new Error('ECONNRESET') }),
    });

    new PinoLogger(pino(sink.stream)).error('payment failed', { err: failure });

    expect(sink.records()).toMatchObject([
      {
        err: {
          type: 'Error',
          message: 'ledger unavailable',
          cause: { type: 'TypeError', message: 'socket closed', cause: { type: 'Error', message: 'ECONNRESET' } },
        },
      },
    ]);

    expect(sink.text().match(/socket closed/g)).toHaveLength(2);
    expect(sink.text().match(/TypeError: socket closed/g)).toHaveLength(1);
    expect(sink.text()).not.toContain('caused by');
  });

  it('stops at a chain of causes that loops', () => {
    const sink = new MemorySink();
    const failure = new Error('first');

    failure.cause = new Error('second', { cause: failure });
    createPinoLogger({ destination: sink.stream }).error('looped', { error: failure });

    expect(sink.text().match(/"message":"first"/g)).toHaveLength(4);
  });

  it('is described in the fields of a child as well', () => {
    const sink = new MemorySink();

    createPinoLogger({ destination: sink.stream })
      .child({ lastFailure: new RangeError('weight out of range') })
      .info('retrying');

    expect(sink.records()).toMatchObject([{ lastFailure: { type: 'RangeError', message: 'weight out of range' } }]);
  });

  it('loses its message with scrubMessages, in its stack too, unless it is a DomainError', () => {
    const sink = new MemorySink();
    const logger = createPinoLogger({ destination: sink.stream, scrubMessages: true });
    const refusal = new OrderAlreadyPaid('order-1', { cause: new Error('duplicate key (email)=(ada@example.org)') });

    logger.error('payment failed', { error: refusal });
    logger.child({ context: 'billing' }).error('insert failed', { error: new Error('row (ada@example.org) refused') });

    expect(sink.text()).not.toContain('ada@example.org');

    expect(sink.records()).toMatchObject([
      {
        error: {
          code: 'ORDER_ALREADY_PAID',
          message: 'Order order-1 is already paid',
          cause: { type: 'Error', message: SCRUBBED_MESSAGE },
        },
      },
      {
        error: { type: 'Error', message: SCRUBBED_MESSAGE, stack: expect.stringMatching(/^\s+at /) },
        context: 'billing',
      },
    ]);
  });
});
