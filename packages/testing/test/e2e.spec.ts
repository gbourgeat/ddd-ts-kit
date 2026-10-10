import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { InMemoryEventBus, type IntegrationEvent } from '@ddd-ts-kit/kernel';
import {
  collectEvents,
  createHttpClient,
  eventually,
  expectProblem,
  expectStatus,
  listenOnRandomPort,
  startTestServer,
  type DatabaseReset,
  type TestServer,
} from '../src/e2e.js';
import { createDataGenerator, generated, useDataGenerator } from '../src/faker.js';
import { resetSequences } from '../src/index.js';
import { aLine, anOrder, type PlaceOrderRequest } from './support/builders.js';

interface OrderView {
  readonly id: string;
  readonly customerId: string;
  readonly status: 'placed' | 'paid';
  readonly placedBy: string | null;
}

/**
 * The application under test: a plain Node server over an in-memory store, announcing each
 * order on the event bus a moment after it answered, as an outbox relay would.
 */
class OrderingApplication implements DatabaseReset {
  readonly events = new InMemoryEventBus();

  private readonly orders = new Map<string, OrderView>();

  async reset(): Promise<void> {
    this.orders.clear();
  }

  readonly handle = (request: IncomingMessage, response: ServerResponse): void => {
    void this.route(request, response);
  };

  private async route(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const { method, url } = request;

    if (method === 'POST' && url === '/orders') return this.place(request, response);

    if (method === 'GET' && url === '/health') return send(response, 200, 'text/plain', 'up');

    if (method === 'GET' && url === '/headers') return sendJson(response, 200, request.headers);

    if (method === 'DELETE') return send(response, 204);

    if (method === 'PUT' || method === 'PATCH') {
      return sendJson(response, 200, { method, received: await readJson(request) });
    }

    const order = this.orders.get(url?.replace('/orders/', '') ?? '');

    return order === undefined ? sendProblem(response, 404, 'NOT_FOUND') : sendJson(response, 200, order);
  }

  private async place(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const body = await readJson(request);

    if (!isPlaceOrderRequest(body) || body.lines.length === 0) {
      return sendProblem(response, 422, 'EMPTY_ORDER');
    }

    const order: OrderView = {
      id: `order-${this.orders.size + 1}`,
      customerId: body.customerId,
      status: 'placed',
      placedBy: request.headers.authorization ?? null,
    };

    this.orders.set(order.id, order);
    setTimeout(() => void this.events.publish([orderPlaced(order)]), 30);
    sendJson(response, 201, order);
  }
}

function orderPlaced(order: OrderView): IntegrationEvent {
  return {
    id: `event-${order.id}`,
    type: 'ordering.order.placed',
    version: 1,
    occurredAt: '2026-01-01T00:00:00.000Z',
    payload: { orderId: order.id },
  };
}

function isPlaceOrderRequest(body: unknown): body is PlaceOrderRequest {
  return typeof body === 'object' && body !== null && 'lines' in body && Array.isArray(body.lines);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  let text = '';

  for await (const chunk of request.setEncoding('utf8')) text += chunk;

  return text === '' ? undefined : JSON.parse(text);
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  send(response, status, 'application/json; charset=utf-8', JSON.stringify(body));
}

function sendProblem(response: ServerResponse, status: number, code: string): void {
  const problem = { type: `urn:problem:${code}`, title: 'Refused', status, code, detail: 'Read the code' };

  send(response, status, 'application/problem+json; charset=utf-8', JSON.stringify(problem));
}

function send(response: ServerResponse, status: number, contentType?: string, body?: string): void {
  if (contentType !== undefined) response.setHeader('Content-Type', contentType);

  response.statusCode = status;
  response.end(body);
}

const application = new OrderingApplication();
let server: TestServer;

beforeAll(async () => {
  server = await startTestServer({
    start: () => listenOnRandomPort(createServer(application.handle)),
    headers: { Authorization: 'Bearer ada' },
  });
});

afterAll(() => server.close());

beforeEach(async () => {
  resetSequences();
  useDataGenerator(createDataGenerator({ seed: 2026 }));
  await application.reset();
});

describe('the JSON client', () => {
  it('posts a JSON body and parses the JSON answer', async () => {
    const response = await server.client.post<OrderView>('/orders', anOrder().buildRequest());

    expect(response.status).toBe(201);
    expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
    expect(response.body).toEqual({ id: 'order-1', customerId: 'customer-1', status: 'placed', placedBy: 'Bearer ada' });
  });

  it('gets, puts, patches and deletes', async () => {
    const { client } = server;
    const { body: order } = expectStatus(await client.post<OrderView>('/orders', anOrder().buildRequest()), 201);

    expect((await client.get<OrderView>(`/orders/${order.id}`)).body.id).toBe(order.id);
    expect((await client.put('/orders/1', { note: 'gift' })).body).toEqual({ method: 'PUT', received: { note: 'gift' } });
    expect((await client.patch('/orders/1', { note: 'none' })).body).toEqual({ method: 'PATCH', received: { note: 'none' } });
    expect(await client.delete('/orders/1')).toMatchObject({ status: 204, body: undefined });
  });

  it('leaves a body that is not JSON as text', async () => {
    const response = await server.client.get('/health');

    expect(response).toMatchObject({ status: 200, body: 'up' });
  });

  it('sends the default headers, and no content type without a body', async () => {
    const { body } = await server.client.get<Record<string, string>>('/headers');

    expect(body.authorization).toBe('Bearer ada');
    expect(body['content-type']).toBeUndefined();
  });

  it('lets a call add a header and replace a default, whatever the case of its name', async () => {
    const { body } = await server.client.get<Record<string, string>>('/headers', {
      headers: { AUTHORIZATION: 'Bearer grace', 'X-Request-Id': 'request-7' },
    });

    expect(body.authorization).toBe('Bearer grace');
    expect(body['x-request-id']).toBe('request-7');
  });

  it('derives a client for another caller without touching the first', async () => {
    const asGrace = server.client.withHeaders({ authorization: 'Bearer grace' });

    const mine = await server.client.post<OrderView>('/orders', anOrder().buildRequest());
    const hers = await asGrace.post<OrderView>('/orders', anOrder().buildRequest());

    expect([mine.body.placedBy, hers.body.placedBy]).toEqual(['Bearer ada', 'Bearer grace']);
  });

  it('is available without a server of its own, for an application already running', async () => {
    const anonymous = createHttpClient(`${server.url}/`);

    expect((await anonymous.get<Record<string, string>>('/headers')).body.authorization).toBeUndefined();
  });
});

describe('expectProblem', () => {
  it('passes on a problem+json answer with that status and code, and returns the document', async () => {
    const response = await server.client.get('/orders/unknown');

    const problem = expectProblem(response, { status: 404, code: 'NOT_FOUND' });

    expect(problem.detail).toBe('Read the code');
    expect(expectProblem(response, { status: 404 }).type).toBe('urn:problem:NOT_FOUND');
  });

  it('fails on another code, another status, or an answer that is not a problem', async () => {
    const refused = await server.client.post('/orders', anOrder().withoutLines().buildRequest());
    const health = await server.client.get('/health');

    expect(() => expectProblem(refused, { status: 422, code: 'ORDER_ALREADY_PAID' })).toThrow(/EMPTY_ORDER/);
    expect(() => expectProblem(refused, { status: 409 })).toThrow(/422/);
    expect(() => expectProblem(health, { status: 200 })).toThrow(/application\/problem\+json/);
  });
});

describe('expectStatus', () => {
  it('shows the body of an unexpected answer, where the API says why', async () => {
    const refused = await server.client.post('/orders', anOrder().withoutLines().buildRequest());

    expect(() => expectStatus(refused, 201)).toThrow(/Expected status 201, received 422 .*EMPTY_ORDER/s);
  });
});

describe('eventually', () => {
  it('returns what the assertion returns once it passes', async () => {
    let attempts = 0;

    const value = await eventually(() => {
      attempts += 1;

      if (attempts < 3) throw new Error('not yet');

      return 'projected';
    }, { intervalMs: 1 });

    expect(value).toBe('projected');
    expect(attempts).toBe(3);
  });

  it('awaits an asynchronous assertion', async () => {
    const { body: order } = await server.client.post<OrderView>('/orders', anOrder().buildRequest());

    const found = await eventually(async () => expectStatus(await server.client.get(`/orders/${order.id}`), 200));

    expect(found.body).toMatchObject({ id: order.id });
  });

  it('fails with the last error once the time is up', async () => {
    let attempts = 0;

    const never = eventually(() => {
      attempts += 1;
      throw new Error(`projection is ${attempts} event(s) behind`);
    }, { timeoutMs: 40, intervalMs: 5 });

    const failure: unknown = await never.catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);

    expect(failure).toMatchObject({
      message: `Still failing after 40 ms: projection is ${attempts} event(s) behind`,
      cause: { message: `projection is ${attempts} event(s) behind` },
    });

    expect(attempts).toBeGreaterThan(1);
  });
});

describe('collectEvents', () => {
  it('records what the application publishes, as another context would receive it', async () => {
    const events = collectEvents(application.events, ['ordering.order.placed']);

    const request = anOrder()
      .placedBy(generated((faker) => ({ id: faker.string.uuid(), name: faker.person.fullName() })))
      .withLine(aLine())
      .buildRequest();

    const { body: order } = expectStatus(await server.client.post<OrderView>('/orders', request), 201);

    const announced = await events.waitFor<{ orderId: string }>(
      'ordering.order.placed',
      (event) => event.payload.orderId === order.id,
    );

    events.stop();

    expect(announced.id).toBe(`event-${order.id}`);
    expect(events.received()).toEqual([announced]);
  });

  it('filters by type, given as a name or as a declaration carrying one', async () => {
    const bus = new InMemoryEventBus();
    const OrderPaid = { type: 'ordering.order.paid' };
    const events = collectEvents(bus, ['ordering.order.placed', OrderPaid]);

    await bus.publish([
      { ...orderPlaced(view('order-1')), type: 'ordering.order.paid' },
      orderPlaced(view('order-2')),
      { ...orderPlaced(view('order-3')), type: 'shipping.parcel.sent' },
    ]);

    expect(events.received().map((event) => event.id)).toEqual(['event-order-1', 'event-order-2']);
    expect(events.received(OrderPaid).map((event) => event.id)).toEqual(['event-order-1']);
    expect((await events.waitFor(OrderPaid)).id).toBe('event-order-1');
  });

  it('stops recording once stopped', async () => {
    const bus = new InMemoryEventBus();
    const events = collectEvents(bus, ['ordering.order.placed']);

    events.stop();
    await bus.publish([orderPlaced(view('order-1'))]);

    expect(events.received()).toEqual([]);
  });

  it('says what it received when the awaited event never comes', async () => {
    const bus = new InMemoryEventBus();
    const events = collectEvents(bus, ['ordering.order.placed']);

    await bus.publish([orderPlaced(view('order-1'))]);

    const waiting = events.waitFor('ordering.order.placed', (event) => event.id === 'event-order-9', {
      timeoutMs: 30,
      intervalMs: 5,
    });

    await expect(waiting).rejects.toThrow(
      'Still failing after 30 ms: No "ordering.order.placed" event matched; 1 of that type received',
    );
  });

  it('refuses to wait for a type it does not collect', () => {
    const events = collectEvents(new InMemoryEventBus(), ['ordering.order.placed']);

    expect(() => events.waitFor('ordering.order.paid')).toThrow('"ordering.order.paid" is not collected');
  });
});

function view(id: string): OrderView {
  return { id, customerId: 'customer-1', status: 'placed', placedBy: null };
}
