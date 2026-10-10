import { describe, expect, it } from 'vitest';
import {
  DeadLetterError,
  DeadLetterReports,
  DomainError,
  FixedExecutionScope,
  InMemoryCommandBus,
  InMemoryErrorReporter,
  InMemoryEventBus,
  NoopErrorReporter,
  Command,
  errorReportOf,
  errorReportingMiddleware,
  executionContext,
  isUnexpectedError,
  reportOnce,
  systemActor,
  type Actor,
  type ErrorReporter,
  type IntegrationEvent,
} from '../src/index.js';

class StockExhausted extends DomainError {
  readonly code = 'STOCK_EXHAUSTED';
}

class ConnectionLost extends Error {
  readonly code = 'ECONNRESET';
}

class ShipOrder extends Command<void> {}

const ada: Actor = { id: 'ada', type: 'user', tenantId: 'acme', roles: [], attributes: {} };
const request = executionContext({ correlationId: 'corr-1', actor: ada, origin: 'http' });

const shipped: IntegrationEvent = {
  id: 'evt-1',
  type: 'ordering.order.shipped',
  version: 1,
  occurredAt: '2026-01-01T00:00:00.000Z',
  payload: {},
  correlationId: 'corr-7',
  traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
};

describe('errorReportOf', () => {
  it('completes what the capture point says from the execution context and the code of the error', () => {
    const report = errorReportOf(new ConnectionLost('socket closed'), { origin: 'command', operation: 'ShipOrder' }, request);

    expect(report).toEqual({
      origin: 'http',
      operation: 'ShipOrder',
      correlationId: 'corr-1',
      actorId: 'ada',
      tenantId: 'acme',
      errorCode: 'ECONNRESET',
      severity: 'error',
    });
  });

  it('keeps the origin of the capture point outside of any execution context, and no code for an error without one', () => {
    expect(errorReportOf(new Error('boom'), { origin: 'process', operation: 'uncaughtException', severity: 'fatal' })).toEqual({
      origin: 'process',
      operation: 'uncaughtException',
      severity: 'fatal',
    });

    expect(errorReportOf({ code: 'a message, not a code' }, { origin: 'command', operation: 'X' })).not.toHaveProperty('errorCode');
  });
});

describe('isUnexpectedError', () => {
  it('tells a business refusal from a fault', () => {
    expect(isUnexpectedError(new StockExhausted('no more pens'))).toBe(false);
    expect(isUnexpectedError(new TypeError('x is not a function'))).toBe(true);
    expect(isUnexpectedError('thrown text')).toBe(true);
  });
});

describe('the reporters of the kernel', () => {
  it('records reports as data, in order', async () => {
    const errors = new InMemoryErrorReporter();
    const failure = new Error('boom');
    const report = errorReportOf(failure, { origin: 'command', operation: 'ShipOrder' });

    errors.report(failure, report);

    expect(errors.reports).toEqual([{ error: failure, report }]);
    await expect(errors.flush()).resolves.toBe(true);

    errors.clear();
    expect(errors.reports).toEqual([]);
  });

  it('reports nothing by default', async () => {
    const errors: ErrorReporter = new NoopErrorReporter();

    errors.report(new Error('ignored'), errorReportOf(undefined, { origin: 'command', operation: 'X' }));

    await expect(errors.flush(10)).resolves.toBe(true);
  });
});

describe('reportOnce', () => {
  const report = errorReportOf(undefined, { origin: 'http', operation: 'shipOrder' });

  it('reports an error object once, whatever the number of boundaries it crosses', () => {
    const errors = new InMemoryErrorReporter();
    const failure = new Error('boom');

    reportOnce(errors, failure, report);
    reportOnce(errors, failure, report);

    expect(errors.reports).toHaveLength(1);
  });

  it('recognises a reported error as the cause of the one that wraps it, or among the errors of an aggregate', () => {
    const errors = new InMemoryErrorReporter();
    const failure = new Error('boom');

    reportOnce(errors, failure, report);
    reportOnce(errors, new Error('wrapped', { cause: failure }), report);
    reportOnce(errors, new AggregateError([failure], 'one handler failed'), report);

    expect(errors.reports).toHaveLength(1);

    reportOnce(errors, new AggregateError([failure, new Error('another')], 'two handlers failed'), report);

    expect(errors.reports).toHaveLength(2);
  });

  it('reports a thrown value that is not an object each time: it cannot be marked', () => {
    const errors = new InMemoryErrorReporter();

    reportOnce(errors, 'thrown text', report);
    reportOnce(errors, 'thrown text', report);

    expect(errors.reports).toHaveLength(2);
  });

  it('never throws when the reporter does', () => {
    const broken: ErrorReporter = {
      report: () => {
        throw new Error('tracker down');
      },
      flush: () => Promise.resolve(false),
    };

    expect(() => {
      reportOnce(broken, new Error('boom'), report);
    }).not.toThrow();
  });
});

describe('errorReportingMiddleware', () => {
  function aBus(failure: unknown, scope = new FixedExecutionScope(request)) {
    const errors = new InMemoryErrorReporter();
    const bus = new InMemoryCommandBus().use(errorReportingMiddleware(errors, scope));

    bus.register(ShipOrder, { execute: () => Promise.reject(failure) });

    return { bus, errors };
  }

  it('reports the command that fails with a fault, named after its class, and lets the failure go on', async () => {
    const failure = new ConnectionLost('socket closed');
    const { bus, errors } = aBus(failure);

    await expect(bus.execute(new ShipOrder())).rejects.toBe(failure);

    expect(errors.reports).toEqual([
      {
        error: failure,
        report: { origin: 'http', operation: 'ShipOrder', correlationId: 'corr-1', actorId: 'ada', tenantId: 'acme', errorCode: 'ECONNRESET', severity: 'error' },
      },
    ]);
  });

  it('never reports a business refusal', async () => {
    const { bus, errors } = aBus(new StockExhausted('no more pens'));

    await expect(bus.execute(new ShipOrder())).rejects.toBeInstanceOf(StockExhausted);

    expect(errors.reports).toEqual([]);
  });

  it('stays silent while an event is being consumed: the delivery is retried, and its provider reports the event it gives up', async () => {
    const consuming = executionContext({ correlationId: 'corr-7', actor: systemActor('shipping.notify'), origin: 'event' });
    const { bus, errors } = aBus(new ConnectionLost('socket closed'), new FixedExecutionScope(consuming));

    await expect(bus.execute(new ShipOrder())).rejects.toBeInstanceOf(ConnectionLost);

    expect(errors.reports).toEqual([]);
  });

  it('names itself as the origin when nothing opened an execution scope', async () => {
    const errors = new InMemoryErrorReporter();
    const bus = new InMemoryCommandBus().use(errorReportingMiddleware(errors));

    bus.register(ShipOrder, { execute: () => Promise.reject(new Error('boom')) });
    await expect(bus.execute(new ShipOrder())).rejects.toThrow('boom');

    expect(errors.reports.map(({ report }) => report)).toEqual([{ origin: 'command', operation: 'ShipOrder', severity: 'error' }]);
  });
});

describe('DeadLetterReports', () => {
  function aConsumer(failure: unknown) {
    const errors = new InMemoryErrorReporter();
    const deadLetters = new DeadLetterReports(errors, { capacity: 2 });
    const bus = new InMemoryEventBus();

    deadLetters.observing(bus).subscribe(shipped.type, () => Promise.reject(failure));

    const deliver = (event: IntegrationEvent = shipped): Promise<void> => bus.publish([event]).catch(() => undefined);

    return { errors, deadLetters, deliver };
  }

  const attempt = { kind: 'handler', consumer: 'shipping.notify', eventId: 'evt-1', eventType: shipped.type, code: 'ECONNRESET' };

  it('does not report a delivery that fails and is retried', async () => {
    const { errors, deadLetters, deliver } = aConsumer(new ConnectionLost('socket closed'));

    await deliver();
    deadLetters.onFailure({ ...attempt, attempt: 1, dead: false });
    deadLetters.onFailure({ kind: 'connection', code: 'ECONNREFUSED' });

    expect(errors.reports).toEqual([]);
  });

  it('reports the event its provider gives up, once, with what its handler threw and the correlation of the event', async () => {
    const failure = new ConnectionLost('socket closed');
    const { errors, deadLetters, deliver } = aConsumer(failure);

    await deliver();
    deadLetters.onFailure({ ...attempt, attempt: 1, dead: false });
    await deliver();
    deadLetters.onFailure({ ...attempt, attempt: 2, dead: true });

    expect(errors.reports).toEqual([
      {
        error: failure,
        report: {
          origin: 'event',
          operation: 'ordering.order.shipped shipping.notify',
          context: 'shipping',
          correlationId: 'corr-7',
          traceId: '0af7651916cd43dd8448eb211c80319c',
          errorCode: 'ECONNRESET',
          severity: 'error',
        },
      },
    ]);
  });

  it('reports a business refusal that buries an event as a warning', async () => {
    const { errors, deadLetters, deliver } = aConsumer(new StockExhausted('no more pens'));

    await deliver();
    deadLetters.onFailure({ ...attempt, code: 'STOCK_EXHAUSTED', dead: true });

    expect(errors.reports).toMatchObject([{ report: { severity: 'warning', errorCode: 'STOCK_EXHAUSTED' } }]);
  });

  it('reports a poison message and a publication that never succeeded, which no handler threw, by their code', () => {
    const errors = new InMemoryErrorReporter();
    const deadLetters = new DeadLetterReports(errors);

    deadLetters.onFailure({ kind: 'poison', queue: 'shipping.notify.work', code: 'POISON_MESSAGE' });
    deadLetters.onFailure({ kind: 'publish', eventId: 'evt-9', eventType: shipped.type, code: 'ETIMEDOUT', dead: true });

    expect(errors.reports.map(({ error }) => error)).toEqual([expect.any(DeadLetterError), expect.any(DeadLetterError)]);

    expect(errors.reports.map(({ report }) => report)).toEqual([
      { origin: 'event', operation: 'poison shipping.notify.work', errorCode: 'POISON_MESSAGE', severity: 'error' },
      { origin: 'event', operation: 'ordering.order.shipped', correlationId: 'evt-9', errorCode: 'ETIMEDOUT', severity: 'error' },
    ]);
  });

  it('forgets the oldest failures beyond its capacity', async () => {
    const failure = new ConnectionLost('socket closed');
    const { errors, deadLetters, deliver } = aConsumer(failure);

    await deliver();
    await deliver({ ...shipped, id: 'evt-2' });
    await deliver({ ...shipped, id: 'evt-3' });
    deadLetters.onFailure({ ...attempt, dead: true });
    deadLetters.onFailure({ ...attempt, eventId: 'evt-3', dead: true });

    expect(errors.reports.map(({ error }) => error)).toEqual([expect.any(DeadLetterError), failure]);
  });
});
