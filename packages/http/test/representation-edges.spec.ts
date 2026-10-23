import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import {
  CsvRepresentation,
  Representations,
  defineRoute,
  executeRoute,
  streamSchemaOf,
  type RawRequest,
  type Route,
} from '../src';
import { AsyncLocalStorageExecutionScope } from '@ddd-ts-kit/kernel';
import { iteratedWithin } from '../src/pipeline/iterated-within';
import { writeStream } from '../src/pipeline/write-stream';
import { SchemaNode } from '../src/schema/schema-node';

const representations = Representations.standard();

const raw = (headers: RawRequest['headers'], body?: unknown): RawRequest => ({
  params: {},
  query: {},
  headers,
  body,
  raw: null,
});

async function* items<T>(...values: T[]): AsyncIterable<T> {
  for (const value of values) {
    await Promise.resolve();
    yield value;
  }
}

async function all<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const read: T[] = [];

  for await (const item of iterable) {
    read.push(item);
  }

  return read;
}

describe('the schema of a streamed list', () => {
  const schema = streamSchemaOf(zodSchema(z.object({ n: z.number() })));

  it('describes an array of its items, and checks each item as it is read', async () => {
    const parsed = schema.parse(items({ n: 1 }, { n: 'two' }));

    expect(schema.toJsonSchema()).toMatchObject({ type: 'array', items: { type: 'object' } });
    expect(parsed.ok).toBe(true);
    await expect(parsed.ok ? all(parsed.value) : Promise.resolve([])).rejects.toThrow('The input is not valid.');
  });

  it('refuses what is no list read as it comes', () => {
    expect(schema.parse([{ n: 1 }])).toMatchObject({ ok: false, error: [{ code: 'invalid_stream' }] });
  });

  it('carries the definitions of its item', () => {
    const item = {
      parse: zodSchema(z.string()).parse,
      toJsonSchema: () => ({ $ref: '#/$defs/A', $defs: { A: {} }, definitions: { B: {} } }),
    };

    expect(streamSchemaOf(item).toJsonSchema()).toEqual({
      type: 'array',
      items: { $ref: '#/$defs/A' },
      $defs: { A: {} },
      definitions: { B: {} },
    });
  });
});

describe('a node of a JSON Schema', () => {
  it('infers an object from its properties and a list from its items', () => {
    expect(SchemaNode.of({ properties: { a: {} } }).type()).toBe('object');
    expect(SchemaNode.of({ items: {} }).type()).toBe('array');
    expect(SchemaNode.of({ type: 'date' }).type()).toBeUndefined();
    expect(SchemaNode.of({}).type()).toBeUndefined();
  });

  it('follows definitions, refuses to loop, and reads what is required', () => {
    const looping = SchemaNode.of({ $ref: '#/definitions/A', definitions: { A: { $ref: '#/definitions/A' } } });

    expect(looping.properties()).toEqual([]);
    expect(SchemaNode.of({ $ref: '#/$defs/Missing' }).node).toEqual({});
    expect(SchemaNode.of({ required: ['a', 1] }).required()).toEqual(['a']);
    expect(SchemaNode.of({}).required()).toEqual([]);
    expect(SchemaNode.of({ oneOf: [{ type: 'null' }] }).type()).toBe(undefined);
    expect(SchemaNode.of({ xml: 'x' }).xml()).toEqual({});
  });

  it('tells a scalar, an enumeration included, from a list and an object', () => {
    expect(SchemaNode.of({ type: 'string' }).isScalar()).toBe(true);
    expect(SchemaNode.of({ enum: ['a'] }).isScalar()).toBe(true);
    expect(SchemaNode.of({ type: 'array', enum: [[1]] }).isScalar()).toBe(true);
    expect(SchemaNode.of({ type: 'object' }).isScalar()).toBe(false);
  });
});

describe('writing a streamed list to a connection', () => {
  function sink(highWaterMark: number): { target: Writable; written: string[] } {
    const written: string[] = [];

    const target = new Writable({
      highWaterMark,
      write(chunk: Buffer, _encoding, done) {
        written.push(chunk.toString());
        setImmediate(done);
      },
    });

    return { target, written };
  }

  it('waits for a slow reader, then ends', async () => {
    const { target, written } = sink(1);

    await writeStream(
      target,
      (async function* () {
        yield 'a';
        yield 'b';
        yield 'c';
      })(),
    );

    expect(written).toEqual(['a', 'b', 'c']);
    expect(target.writableEnded).toBe(true);
  });

  it('stops reading the list once the reader has left', async () => {
    const { target, written } = sink(1024);
    let read = 0;

    target.destroy();

    await writeStream(
      target,
      (async function* () {
        read += 1;
        yield 'a';
        read += 1;
        yield 'b';
      })(),
    );

    expect(written).toEqual([]);
    expect(read).toBe(1);
  });

  it('cuts the connection when the list fails half way', async () => {
    const { target } = sink(1024);
    const closed = new Promise((resolve) => target.on('error', resolve));

    await writeStream(
      target,
      (async function* () {
        yield 'a';
        throw new Error('cursor lost');
      })(),
    );

    expect(await closed).toMatchObject({ message: 'cursor lost' });
    expect(target.destroyed).toBe(true);
  });
});

describe('the pipeline with representations, at its edges', () => {
  const echo = defineRoute(
    {
      method: 'POST',
      path: '/files',
      operationId: 'storeFile',
      summary: 'Store',
      request: { body: zodSchema(z.unknown()) },
      responses: {
        200: { description: 'ok', body: streamSchemaOf(zodSchema(z.object({ id: z.string() }))) },
        204: { description: 'none' },
      },
      security: false,
      produces: ['text/csv'],
    },
    ({ body }) => (body === 'nothing' ? { status: 204 } : { status: 200, body: items<{ id: string }>() }),
  );

  it('answers no body with no content type, and an empty list with its header line alone', async () => {
    const none = await executeRoute(echo, raw({ 'content-type': 'application/json' }, '"nothing"'), {
      representations,
    });

    const empty = await executeRoute(echo, raw({ accept: ['text/csv', 'application/xml'] }, {}), { representations });

    expect(none.status).toBe(204);
    expect(none.headers['content-type']).toBeUndefined();
    expect(await all(empty.stream ?? items())).toEqual(['id\r\n']);
  });

  it('leaves a binary body of the handler as it is', async () => {
    const binary = { ...echo, handle: () => ({ status: 200, body: new Uint8Array([1, 2]) }) };
    const response = await executeRoute(binary, raw({}), { representations });

    expect(response.body).toEqual(new Uint8Array([1, 2]));
    expect(response.headers['content-type']).toBe('application/octet-stream');
  });

  it('reads no body of a route that declares none, whatever its content type', async () => {
    const bare = { ...echo, request: {}, handle: () => ({ status: 204 }) };
    const response = await executeRoute(bare, raw({ 'content-type': 'text/plain' }, 'x'), { representations });

    expect(response.status).toBe(204);
  });

  it('adds accept to the Vary header the handler sets, once', async () => {
    const varying = (vary: string) => ({
      ...echo,
      handle: () => ({ status: 200, body: items(), headers: { Vary: vary } }),
    });

    const response = async (vary: string) =>
      (await executeRoute(varying(vary), raw({ accept: 'text/csv' }), { representations })).headers['vary'];

    expect(await response('origin')).toBe('origin, accept');
    expect(await response('Accept, origin')).toBe('Accept, origin');
    expect(await response('*')).toBe('*');
  });

  it('answers a route that declares no body schema whatever the request accepts', async () => {
    const download: Route = {
      method: 'GET',
      path: '/download',
      operationId: 'download',
      summary: 'Download',
      security: false,
      responses: { 200: { description: 'The file.' } },
      handle: () => ({ status: 200, body: new Uint8Array([37, 80]), headers: { 'content-type': 'application/pdf' } }),
    };

    const response = await executeRoute(download, raw({ accept: 'application/pdf' }), { representations });

    expect([response.status, response.headers['content-type'], response.headers['vary']]).toEqual([
      200,
      'application/pdf',
      undefined,
    ]);
  });

  it('fails as a defect when another parser read a body its representation must read', async () => {
    const xml = { ...echo, consumes: ['application/xml'] };

    const response = await executeRoute(xml, raw({ 'content-type': 'application/xml' }, { parsed: true }), {
      representations,
    });

    expect(response.status).toBe(500);
  });

  it('answers in no media type the registry does not know, even if the route declares it', () => {
    expect(representations.offeredBy({ produces: ['application/yaml'] })).toEqual(['application/json']);
    expect(representations.answerIn('application/yaml')).toBeUndefined();
    expect(representations.readerOf({ consumes: ['text/csv'] }, 'text/csv')).toBeUndefined();
  });

  it('writes a CSV body that is a plain list, and nothing for what is no list', async () => {
    const csv = new CsvRepresentation();
    const shape = { name: 'x', schema: { type: 'array', items: { type: 'object', properties: { a: {} } } } };

    expect(await all(toIterable(csv.write([{ a: 1 }, 'not a row'], shape)))).toEqual(['a\r\n', '1\r\n', '\r\n']);
    expect(await all(toIterable(csv.write('nothing', shape)))).toEqual(['a\r\n']);
  });
});

function toIterable(written: string | AsyncIterable<string>): AsyncIterable<string> {
  return typeof written === 'string' ? (items(written) as AsyncIterable<string>) : written;
}

describe('a list streamed after its handler returned', () => {
  it('is read inside the scope of its request, where an adapter still sees who acts', async () => {
    const scope = new AsyncLocalStorageExecutionScope();

    async function* seen(): AsyncIterable<{ id: string }> {
      await Promise.resolve();
      yield { id: scope.current()?.correlationId ?? 'outside' };
      yield { id: scope.current()?.correlationId ?? 'outside' };
    }

    const exported = defineRoute(
      {
        method: 'GET',
        path: '/seen',
        operationId: 'exportSeen',
        summary: 'Seen',
        responses: { 200: { description: 'ok', body: streamSchemaOf(zodSchema(z.object({ id: z.string() }))) } },
        security: false,
      },
      () => ({ status: 200, body: seen() }),
    );

    const response = await executeRoute(exported, raw({ 'x-correlation-id': 'c-42' }), {
      representations,
      executionScope: scope,
      withPrincipal: (_principal, work) => work(),
    });

    expect(await all(response.stream ?? items())).toEqual(['[', '{"id":"c-42"}', ',{"id":"c-42"}', ']']);
  });

  it('closes what it reads when the reader stops early', async () => {
    let closed = false;

    async function* endless(): AsyncIterable<number> {
      try {
        for (let n = 0; ; n += 1) {
          yield n;
        }
      } finally {
        closed = true;
      }
    }

    const iterator = iteratedWithin(endless(), (work) => work())[Symbol.asyncIterator]();

    await iterator.next();
    await iterator.return?.();

    expect(closed).toBe(true);
  });
});
