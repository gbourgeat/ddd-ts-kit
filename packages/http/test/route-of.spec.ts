import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { anonymousActor, type Actor } from '@ddd-ts-kit/kernel';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import {
  Authenticated,
  Controller,
  HasRole,
  RouteGroup,
  createErrorMapper,
  defineRoute,
  type HttpRequest,
} from '../src';
import { routeOf, type RouteOfOptions } from '../src/testing';

const params = zodSchema(z.object({ invoiceId: z.string().min(1) }));
const body = zodSchema(z.object({ reason: z.string().min(1) }));
const accepted = zodSchema(z.object({ id: z.string().min(1) }), { io: 'output' });

/** What the controllers of this spec were handed, as a recording bus keeps its commands. */
const received: unknown[] = [];

/* Declared by calling the decorators: the specs are not compiled with decorators. */
class InvoiceRoutes {}

RouteGroup({ prefix: '/invoices', guards: [Authenticated] })(InvoiceRoutes);

class CancelInvoiceController {
  constructor(private readonly answer = 'cancellation-1') {}

  async handle(
    request: HttpRequest<{ params: { invoiceId: string }; body: { reason: string } }>,
  ): Promise<{ id: string }> {
    received.push({ actor: request.actor, invoiceId: request.params.invoiceId, reason: request.body.reason });

    return { id: this.answer };
  }
}

Controller({
  group: InvoiceRoutes,
  method: 'POST',
  path: '/:invoiceId/cancellation',
  summary: 'Cancel invoice',
  params,
  body,
  response: { status: 201, body: accepted },
})(CancelInvoiceController);

class AuditInvoiceController {
  async handle(): Promise<void> {
    received.push('audited');
  }
}

Controller({
  group: InvoiceRoutes,
  method: 'POST',
  path: '/:invoiceId/audit',
  summary: 'Audit invoice',
  guards: [HasRole('auditor')],
  params,
  response: { status: 204 },
})(AuditInvoiceController);

const auditor: Actor = { id: 'auditor-1', type: 'user', roles: ['auditor'], attributes: {} };

describe('routeOf', () => {
  it('sends a request to a controller through its guards, as an authenticated user, and answers what it declares', async () => {
    received.length = 0;

    const { route, caller, send } = routeOf(new CancelInvoiceController());

    const response = await send({ params: { invoiceId: 'invoice-1' }, body: { reason: 'Duplicate' } });

    expect(response).toMatchObject({ status: 201, body: { id: 'cancellation-1' } });
    expect(received).toEqual([{ actor: caller, invoiceId: 'invoice-1', reason: 'Duplicate' }]);
    expect(caller).toEqual({ id: 'user-1', type: 'user', roles: [], attributes: {} });
    expect(route.path).toBe('/invoices/:invoiceId/cancellation');
  });

  it('refuses a body that does not have the declared shape with 422, before the controller', async () => {
    received.length = 0;

    const response = await routeOf(new CancelInvoiceController()).send({ params: { invoiceId: 'invoice-1' } });

    expect(response.status).toBe(422);
    expect(received).toEqual([]);
  });

  it('sends as the caller the spec names: nobody is refused by the guards with 401, a role passes its guard', async () => {
    received.length = 0;

    const anonymous = await routeOf(new CancelInvoiceController(), { caller: anonymousActor() }).send({
      params: { invoiceId: 'invoice-1' },
      body: { reason: 'Duplicate' },
    });

    const clerk = await routeOf(new AuditInvoiceController()).send({ params: { invoiceId: 'invoice-1' } });

    const audit = await routeOf(new AuditInvoiceController(), { caller: auditor }).send({
      params: { invoiceId: 'invoice-1' },
    });

    expect([anonymous.status, clerk.status, audit.status]).toEqual([401, 403, 204]);
    expect(received).toEqual(['audited']);
  });

  it('leaves the guards out when the spec says so once, and builds a controller given as its class with its schemes', async () => {
    received.length = 0;

    const { route, send } = routeOf(AuditInvoiceController, {
      guards: 'skip',
      security: ['apiKey'],
      resolve: <T>(target: abstract new (...args: never) => T): T => Reflect.construct(target, []),
    });

    expect((await send({ params: { invoiceId: 'invoice-1' } })).status).toBe(204);
    expect(received).toEqual(['audited']);
    expect(route.security).toEqual(['apiKey']);
  });

  it('checks every answer against the declaration, unless the spec says otherwise, and hands the pipeline its options', async () => {
    const request = { params: { invoiceId: 'invoice-1' }, body: { reason: 'Duplicate' } };

    const checked = await routeOf(new CancelInvoiceController('')).send(request);
    const unchecked = await routeOf(new CancelInvoiceController(''), { validateResponses: false }).send(request);

    // What a caller in JavaScript, or an options object spread from a partial one, may hand over.
    const unsaid: RouteOfOptions = Object.fromEntries([['validateResponses', undefined]]);
    const stillChecked = await routeOf(new CancelInvoiceController(''), unsaid).send(request);

    const mapped = await routeOf(new CancelInvoiceController(), {
      caller: anonymousActor(),
      errorMapper: createErrorMapper({ UNAUTHORIZED: 403 }),
    }).send(request);

    expect(checked.status).toBe(500);
    expect(stillChecked.status).toBe(500);
    expect(unchecked).toMatchObject({ status: 201, body: { id: '' } });
    expect(mapped.status).toBe(403);
  });

  it('sends a request to a route already built, and refuses what only builds the route of a controller', async () => {
    const ping = defineRoute(
      {
        method: 'GET',
        path: '/ping',
        operationId: 'ping',
        summary: 'Ping',
        responses: { 200: { description: 'Pong.', body: accepted } },
        security: false,
      },
      () => ({ status: 200, body: { id: 'pong' } }),
    );

    expect(await routeOf(ping).send()).toMatchObject({ status: 200, body: { id: 'pong' } });
    expect(await routeOf(ping).send({ stream: Readable.from([]) })).toMatchObject({ status: 200 });
    expect(() => routeOf(ping, { guards: 'skip' })).toThrow('ping is a route already built');
  });
});
