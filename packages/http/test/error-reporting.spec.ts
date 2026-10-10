import { describe, expect, it } from 'vitest';
import {
  AsyncLocalStorageExecutionScope,
  Command,
  DomainError,
  InMemoryCommandBus,
  InMemoryErrorReporter,
  errorReportingMiddleware,
  type Actor,
} from '@ddd-ts-kit/kernel';
import { createErrorMapper, defineRoute, executeRoute, reportHttpErrors, type RawRequest } from '../src/index.js';

class LedgerUnavailable extends DomainError {
  readonly code = 'LEDGER_UNAVAILABLE';
}

class OrderAlreadyShipped extends DomainError {
  readonly code = 'ORDER_ALREADY_SHIPPED';
}

class ShipOrder extends Command<void> {}

const ada: Actor = { id: 'ada', type: 'user', tenantId: 'acme', roles: [], attributes: {} };

const request: RawRequest = {
  params: {},
  query: {},
  headers: { 'x-correlation-id': 'corr-1' },
  body: undefined,
  raw: undefined,
};

function shipOrderRoute(handle: () => Promise<void>) {
  return defineRoute(
    { method: 'POST', path: '/orders/ship', operationId: 'shipOrder', summary: 'Ships', security: false, responses: { 204: { description: 'Shipped' } } },
    async () => {
      await handle();

      return { status: 204 };
    },
  );
}

function aServer() {
  const errors = new InMemoryErrorReporter();

  const options = {
    onError: reportHttpErrors(errors),
    errorMapper: createErrorMapper({ LEDGER_UNAVAILABLE: 503, ORDER_ALREADY_SHIPPED: 409 }),
    resolvePrincipal: () => ada,
  };

  return { errors, answer: (handle: () => Promise<void>) => executeRoute(shipOrderRoute(handle), request, options) };
}

describe('reportHttpErrors', () => {
  it('reports the request answered 500, with the identifiers of its execution context', async () => {
    const { errors, answer } = aServer();
    const failure = new TypeError('x is not a function');

    const response = await answer(() => Promise.reject(failure));

    expect(response.status).toBe(500);

    expect(errors.reports).toEqual([
      {
        error: failure,
        report: { origin: 'http', operation: 'shipOrder', correlationId: 'corr-1', actorId: 'ada', tenantId: 'acme', severity: 'error' },
      },
    ]);
  });

  it('leaves a business refusal alone: a 4xx is an answer, not an incident', async () => {
    const { errors, answer } = aServer();

    const response = await answer(() => Promise.reject(new OrderAlreadyShipped('Order 42 left yesterday')));

    expect(response.status).toBe(409);
    expect(errors.reports).toEqual([]);
  });

  it('reports a domain error the mapper answers as a server fault, by its code', async () => {
    const { errors, answer } = aServer();

    const response = await answer(() => Promise.reject(new LedgerUnavailable('The ledger is closed for maintenance')));

    expect(response.status).toBe(503);
    expect(errors.reports).toMatchObject([{ report: { operation: 'shipOrder', errorCode: 'LEDGER_UNAVAILABLE' } }]);
  });

  it('reports a request refused before its execution context existed, by its correlation alone', async () => {
    const errors = new InMemoryErrorReporter();

    const response = await executeRoute(shipOrderRoute(() => Promise.resolve()), request, {
      onError: reportHttpErrors(errors),
      resolvePrincipal: () => {
        throw new Error('identity provider down');
      },
    });

    expect(response.status).toBe(500);
    expect(errors.reports.map(({ report }) => report)).toEqual([{ origin: 'http', operation: 'shipOrder', correlationId: 'corr-1', severity: 'error' }]);
  });

  it('does not report again the failure of a command its bus already reported', async () => {
    const errors = new InMemoryErrorReporter();
    const executionScope = new AsyncLocalStorageExecutionScope();
    const bus = new InMemoryCommandBus().use(errorReportingMiddleware(errors, executionScope));

    bus.register(ShipOrder, { execute: () => Promise.reject(new Error('socket closed')) });

    const response = await executeRoute(shipOrderRoute(() => bus.execute(new ShipOrder())), request, {
      onError: reportHttpErrors(errors),
      executionScope,
      resolvePrincipal: () => ada,
    });

    expect(response.status).toBe(500);

    expect(errors.reports.map(({ report }) => report)).toEqual([
      { origin: 'http', operation: 'ShipOrder', correlationId: 'corr-1', actorId: 'ada', tenantId: 'acme', severity: 'error' },
    ]);
  });
});
