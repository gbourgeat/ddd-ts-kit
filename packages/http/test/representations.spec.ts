import express from 'express';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { DeclarationError } from '@ddd-ts-kit/kernel/declarations';
import { z } from 'zod';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import {
  Controller,
  Public,
  Representations,
  controllerRoute,
  defineRoute,
  executeRoute,
  serializeBody,
  type RawRequest,
  type Representation,
  type Route,
  type RouteResponse,
} from '../src/index.js';
import { mountExpress } from '../src/express.js';
import { mountFastify } from '../src/fastify.js';
import { catalogRoutes } from './support/catalog.js';

const representations = Representations.standard();

const request = (headers: RawRequest['headers'] = {}, body?: unknown): RawRequest => ({
  params: {},
  query: {},
  headers,
  body,
  raw: null,
});

async function text(response: RouteResponse): Promise<string> {
  // The JSON of the kit stays a value, which the adapter writes as JSON; another representation is bytes or chunks.
  const serialized = serializeBody(response);
  let written = serialized instanceof Uint8Array ? new TextDecoder().decode(serialized) : (serialized ?? '');

  for await (const chunk of response.stream ?? []) {
    written += chunk;
  }

  return written;
}

const OPERATIONS = ['searchProducts', 'exportProducts', 'addProduct'];

function route(index: number): Route {
  const found = catalogRoutes.find(({ operationId }) => operationId === OPERATIONS[index]);

  if (found === undefined) {
    throw new Error('The catalog lost a route.');
  }

  return found;
}

/** JSON indented, as a project could prefer it. */
class PrettyJson implements Representation {
  readonly mediaType = 'application/json';

  readonly problemMediaType = 'application/problem+json';

  write(body: unknown): string {
    return JSON.stringify(body, null, 2);
  }
}

describe('a route that answers in several media types', () => {
  it('answers JSON when the request says nothing, and says that the answer varies with Accept', async () => {
    const response = await executeRoute(route(0), request(), { representations });

    expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
    expect(response.headers['vary']).toBe('accept');
    expect(JSON.parse(await text(response))).toMatchObject({ total: 2, items: [{ id: '1' }, { id: '2' }] });
  });

  it('answers in the media type the Accept header prefers', async () => {
    const response = await executeRoute(route(0), request({ accept: 'text/csv;q=0.5, application/xml' }), {
      representations,
    });

    expect(response.headers['content-type']).toBe('application/xml; charset=utf-8');
    expect(await text(response)).toContain('<searchProducts xmlns:xsi=');
  });

  it('answers 406 in JSON when no media type it answers in is accepted, without running the handler', async () => {
    let ran = false;
    const watched = { ...route(0), handle: () => ((ran = true), { status: 200 }) };
    const response = await executeRoute(watched, request({ accept: 'image/png' }), { representations });

    expect(response.status).toBe(406);
    expect(response.headers['content-type']).toBe('application/problem+json; charset=utf-8');
    expect(JSON.parse(await text(response))).toMatchObject({ code: 'NOT_ACCEPTABLE' });
    expect(ran).toBe(false);
  });

  it('writes a refusal as application/problem+xml when XML was negotiated', async () => {
    const response = await executeRoute(route(2), request({ accept: 'application/xml' }, {}), { representations });

    expect(response.status).toBe(422);
    expect(response.headers['content-type']).toBe('application/problem+xml; charset=utf-8');

    expect(await text(response)).toMatch(
      /^<\?xml[^>]*\?><problem xmlns="urn:ietf:rfc:7807"[^>]*><type>urn:problem:validation-failed<\/type>/,
    );
  });

  it('writes a refusal of a CSV answer as application/problem+json, CSV having no problem type', async () => {
    const failing = { ...route(0), handle: () => Promise.reject(new Error('down')) };
    const response = await executeRoute(failing, request({ accept: 'text/csv' }), { representations });

    expect(response.status).toBe(500);
    expect(response.headers['content-type']).toBe('application/problem+json; charset=utf-8');
  });

  it('streams a list read as it comes, chunk by chunk', async () => {
    const response = await executeRoute(route(1), request({ accept: 'text/csv' }), { representations });

    expect(response.body).toBeUndefined();

    expect(await text(response)).toBe(
      'id,name,price,currency,status,releasedAt,stock\r\n' +
        '1,"Kettle, ""steel""",12.30,EUR,on-sale,2026-03-01T08:30:00.000Z,4\r\n' +
        "2,'=SUM(A1),0.99,EUR,withdrawn,2026-03-01T08:30:00.000Z,\r\n",
    );
  });

  it('answers a problem rather than a cut stream when the list fails before its first item', async () => {
    const failing = {
      ...route(1),
      handle: () => ({
        status: 200,
        body: { [Symbol.asyncIterator]: () => ({ next: () => Promise.reject(new Error('no cursor')) }) },
      }),
    };

    const response = await executeRoute(failing, request({ accept: 'text/csv' }), { representations });

    expect(response.status).toBe(500);
  });

  it('leaves the answer of a route unchanged when the application registers no representation', async () => {
    const response = await executeRoute(route(0), request({ accept: 'application/xml' }), {});

    expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
    expect(response.body).toMatchObject({ total: 2 });
  });
});

describe('a body sent in another media type', () => {
  const xml =
    '<addProduct><name>Teapot &amp; cup</name><price>3.50</price><quantities>1</quantities><quantities>2</quantities></addProduct>';

  it('is read by the representation of its media type, then validated by the same schema', async () => {
    const response = await executeRoute(
      route(2),
      request({ 'content-type': 'application/xml; charset=utf-8', accept: 'application/json' }, xml),
      { representations },
    );

    expect(response.status).toBe(201);
    expect(JSON.parse(await text(response))).toMatchObject({ id: '2', name: 'Teapot & cup', price: '3.50' });
  });

  it('is refused by the same schema as JSON when it holds an element the schema does not declare', async () => {
    const response = await executeRoute(
      route(2),
      request(
        { 'content-type': 'application/xml' },
        '<addProduct><name>Pot</name><price>1</price><colour>red</colour></addProduct>',
      ),
      { representations },
    );

    expect(response.status).toBe(422);
  });

  it('is refused as malformed, without quoting it, when it is no XML', async () => {
    const response = await executeRoute(route(2), request({ 'content-type': 'application/xml' }, '<a><b></a>'), {
      representations,
    });

    expect(JSON.parse(await text(response))).toMatchObject({
      status: 422,
      issues: [{ path: 'body', code: 'malformed', message: 'The body is not well-formed application/xml.' }],
    });
  });

  it('is refused with 415 in a media type the route does not read', async () => {
    const response = await executeRoute(route(2), request({ 'content-type': 'text/csv' }, 'name\r\nPot'), {
      representations,
    });

    expect(response.status).toBe(415);
    expect(JSON.parse(await text(response))).toMatchObject({ code: 'UNSUPPORTED_MEDIA_TYPE' });
  });

  it('is parsed as JSON when a framework hands JSON over as text', async () => {
    const response = await executeRoute(
      route(2),
      request({ 'content-type': 'application/json' }, JSON.stringify({ name: 'Pot', price: '1' })),
      { representations },
    );

    expect(response.status).toBe(201);
  });
});

describe('the representations of the platform', () => {
  it('refuse, when the routes are mounted, a media type nothing provides', () => {
    const unknown = { ...route(0), produces: ['application/yaml'] };

    expect(() => representations.assertServes([unknown])).toThrow(DeclarationError);
    expect(() => representations.assertServes([unknown])).toThrow(/no representation of the platform provides it/);
  });

  it('refuse a CSV answer whose rows hold a list, and one that is no list', () => {
    const nested = defineRoute(
      {
        method: 'GET',
        path: '/baskets',
        operationId: 'searchBaskets',
        summary: 'Baskets',
        responses: { 200: { description: 'ok', body: zodSchema(z.array(z.object({ lines: z.array(z.string()) }))) } },
        security: false,
        produces: ['text/csv'],
      },
      () => ({ status: 200, body: new Array<{ lines: string[] }>() }),
    );

    const single = {
      ...nested,
      responses: { 200: { description: 'ok', body: zodSchema(z.object({ id: z.string() })) } },
    };

    expect(() => representations.assertServes([nested])).toThrow('the column "lines" holds a list or an object');
    expect(() => representations.assertServes([single])).toThrow('the body is no list and no page of items');
  });

  it('refuse a route that consumes a media type no representation reads', () => {
    expect(() => representations.assertServes([{ ...route(2), consumes: ['text/csv'] }])).toThrow(/never read/);
  });

  it('accept the routes they serve', () => {
    expect(() => representations.assertServes(catalogRoutes)).not.toThrow();
  });

  it('are required by a route that produces or consumes another media type than JSON', () => {
    const app = express();

    expect(() => mountExpress(app, catalogRoutes)).toThrow(/declares produces or consumes, and no representations/);
    expect(() => mountFastify(Fastify(), catalogRoutes)).toThrow(DeclarationError);
    expect(() => mountExpress(app, catalogRoutes, { representations })).not.toThrow();
  });

  it('let a project replace JSON with its own', async () => {
    const response = await executeRoute(route(0), request(), { representations: Representations.of(new PrettyJson()) });

    expect(await text(response)).toContain('\n  "items"');
  });
});

describe('a controller that answers in several media types', () => {
  it('carries what it produces and consumes to its route', () => {
    class ExportLedgerController {
      handle(): void {}
    }

    Controller({
      method: 'GET',
      path: '/ledger/export',
      summary: 'Export',
      response: { status: 204 },
      guards: [Public],
      produces: ['text/csv'],
      consumes: ['application/xml'],
    })(ExportLedgerController);

    expect(controllerRoute(new ExportLedgerController())).toMatchObject({
      produces: ['text/csv'],
      consumes: ['application/xml'],
    });
  });
});
