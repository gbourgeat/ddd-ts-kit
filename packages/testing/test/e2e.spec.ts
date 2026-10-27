import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { InMemoryEventBus } from '@ddd-ts-kit/kernel';
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
} from '../src/e2e';
import { createDataGenerator, generated, useDataGenerator } from '../src/faker';
import { resetSequences } from '../src';
import { aLine, anOrder, type PlaceOrderRequest } from './support/builders';
import { orderPlaced } from './support/order-placed';

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

  /** The announcements not yet published: a reset drops them, or they reach the spec after it, under an id it reuses. */
  private readonly announcements = new Set<ReturnType<typeof setTimeout>>();

  async reset(): Promise<void> {
    this.orders.clear();

    for (const announcement of this.announcements) {
      clearTimeout(announcement);
    }

    this.announcements.clear();
  }

  readonly handle = (request: IncomingMessage, response: ServerResponse): void => {
    void this.route(request, response);
  };

  private async route(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const { method, url } = request;

    if (method === 'POST' && url === '/orders') {
      return this.place(request, response);
    }

    if (method === 'GET' && url === '/health') {
      return send(response, 200, 'text/plain', 'up');
    }

    if (method === 'GET' && url === '/headers') {
      return sendJson(response, 200, request.headers);
    }

    if (method === 'POST' && url === '/echo') {
      return sendJson(response, 200, { contentType: request.headers['content-type'], text: await readText(request) });
    }

    if (method === 'DELETE') {
      return send(response, 204);
    }

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

    const announcement = setTimeout(() => {
      this.announcements.delete(announcement);
      void this.events.publish([orderPlaced(order)]);
    }, 30);

    this.announcements.add(announcement);
    sendJson(response, 201, order);
  }
}

function isPlaceOrderRequest(body: unknown): body is PlaceOrderRequest {
  return typeof body === 'object' && body !== null && 'lines' in body && Array.isArray(body.lines);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const text = await readText(request);

  return text === '' ? undefined : JSON.parse(text);
}

async function readText(request: IncomingMessage): Promise<string> {
  let text = '';

  for await (const chunk of request.setEncoding('utf8')) {
    text += chunk;
  }

  return text;
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  send(response, status, 'application/json; charset=utf-8', JSON.stringify(body));
}

function sendProblem(response: ServerResponse, status: number, code: string): void {
  const problem = { type: `urn:problem:${code}`, title: 'Refused', status, code, detail: 'Read the code' };

  send(response, status, 'application/problem+json; charset=utf-8', JSON.stringify(problem));
}

function send(response: ServerResponse, status: number, contentType?: string, body?: string): void {
  if (contentType !== undefined) {
    response.setHeader('Content-Type', contentType);
  }

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

    expect(response.body).toEqual({
      id: 'order-1',
      customerId: 'customer-1',
      status: 'placed',
      placedBy: 'Bearer ada',
    });
  });

  it('gets, puts, patches and deletes', async () => {
    const { client } = server;
    const { body: order } = expectStatus(await client.post<OrderView>('/orders', anOrder().buildRequest()), 201);

    expect((await client.get<OrderView>(`/orders/${order.id}`)).body.id).toBe(order.id);

    expect((await client.put('/orders/1', { note: 'gift' })).body).toEqual({
      method: 'PUT',
      received: { note: 'gift' },
    });

    expect((await client.patch('/orders/1', { note: 'none' })).body).toEqual({
      method: 'PATCH',
      received: { note: 'none' },
    });

    expect(await client.delete('/orders/1')).toMatchObject({ status: 204, body: undefined });
  });

  it('leaves a body that is not JSON as text', async () => {
    const response = await server.client.get('/health');

    expect(response).toMatchObject({ status: 200, body: 'up' });
  });

  it('sends a text as it is in the media type a call names, and as JSON otherwise', async () => {
    const xml = await server.client.post('/echo', '<order/>', { headers: { 'content-type': 'application/xml' } });
    const json = await server.client.post('/echo', '<order/>');

    expect(xml.body).toEqual({ contentType: 'application/xml', text: '<order/>' });
    expect(json.body).toEqual({ contentType: 'application/json', text: '"<order/>"' });
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
  it('awaits an asynchronous assertion', async () => {
    const { body: order } = await server.client.post<OrderView>('/orders', anOrder().buildRequest());

    const found = await eventually(async () => expectStatus(await server.client.get(`/orders/${order.id}`), 200));

    expect(found.body).toMatchObject({ id: order.id });
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
});
