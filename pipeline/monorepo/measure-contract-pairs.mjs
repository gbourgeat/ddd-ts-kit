#!/usr/bin/env node
/**
 * Measures, on this machine, what docs/tools/contract-pairs.md compares: how long each framework
 * takes from a cold process to its first answer, how many requests a second it serves through
 * the pipeline of the kit next to a bare handler of its own, what one validation costs with each
 * library, and how long the OpenAPI document of many routes takes to generate. Run after
 * `npm run build`, on an otherwise quiet machine; the numbers are for comparing the pairs with
 * each other, not absolute.
 *
 *   node pipeline/monorepo/measure-contract-pairs.mjs
 */
import 'reflect-metadata';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { typeboxSchema } from '@ddd-ts-kit/validation/typebox';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { acceptedSchema, defineRoute, executeRoute } from '@ddd-ts-kit/http';
import { generateOpenApi } from '@ddd-ts-kit/http/openapi';
import { IsISO8601, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { Type as Nested } from 'class-transformer';
import Type from 'typebox';
import { z } from 'zod';

const ROOT = path.resolve(import.meta.dirname, '../..');
const DOCUMENTED_ROUTES = 200;
const PARSES = 50_000;
const EXECUTIONS = 20_000;
const REQUESTS = 4_000;
const WARM_UP = 1_000;
const CONCURRENCY = 32;
const COLD_RUNS = 5;
const COLD_ROUTES = 50;

const VALID_BODY = {
  patientId: '0b8f6e0e-2f4b-4c58-9c0e-6f1d2a3b4c5d',
  reason: 'Check-up',
  slot: { startsAt: '2026-10-13T09:00:00Z', endsAt: '2026-10-13T09:30:00Z' },
};

const LIBRARIES = { zod: zodBody, typebox: typeboxBody, 'class-validator': classBody };

const FRAMEWORKS = ['express', 'fastify', 'hono', 'nest'];

async function main() {
  console.log(`Node ${process.version}, ${process.platform} ${process.arch}\n`);
  console.log(
    table(
      'Contract generation and validation',
      ['library', 'document of 200 routes (ms)', 'one parse (µs)', 'components'],
      contractRows(),
    ),
  );
  console.log(table('The pipeline of the kit, in the process', ['body', 'one request (µs)'], await pipelineRows()));
  console.log(
    table(
      'Requests through the kit',
      ['framework', 'kit (req/s)', 'bare (req/s)', 'kit p99 (ms)'],
      await requestRows(),
    ),
  );
  console.log(table('Cold start to the first answer', ['framework', `median of ${COLD_RUNS} (ms)`], await coldRows()));
}

function contractRows() {
  return Object.entries(LIBRARIES).map(([name, body]) => {
    const schema = body();
    const routes = Array.from({ length: DOCUMENTED_ROUTES }, (_unused, index) => commandRoute(`/r${index}`, schema));
    const generate = () => generateOpenApi({ info: { title: 'Measure', version: '1' }, routes });
    const document = generate();

    return [
      name,
      median(repeat(7, () => timed(generate))).toFixed(1),
      perParse(schema),
      String(Object.keys(document.components.schemas).length),
    ];
  });
}

function perParse(schema) {
  const elapsed = timed(() => {
    for (let index = 0; index < PARSES; index += 1) {
      schema.parse(VALID_BODY);
    }
  });

  return ((elapsed * 1000) / PARSES).toFixed(2);
}

/** `executeRoute` alone, as every adapter calls it: principal, validation, handler, answer. */
async function pipelineRows() {
  const rows = [];
  const bodies = [['none', undefined], ...Object.entries(LIBRARIES).map(([name, body]) => [name, body()])];

  for (const [name, schema] of bodies) {
    const route = commandRoute('/r0', schema);
    const request = { params: {}, query: {}, headers: {}, body: VALID_BODY, raw: {} };
    const started = performance.now();

    for (let index = 0; index < EXECUTIONS; index += 1) {
      await executeRoute(route, request, {});
    }

    rows.push([name, (((performance.now() - started) * 1000) / EXECUTIONS).toFixed(2)]);
  }

  return rows;
}

async function requestRows() {
  const rows = [];

  for (const framework of FRAMEWORKS) {
    const kit = await load(framework, 'kit');
    const bare = framework === 'nest' ? undefined : await load(framework, 'bare');

    rows.push([framework, kit.rate.toFixed(0), bare === undefined ? 'n/a' : bare.rate.toFixed(0), kit.p99.toFixed(1)]);
  }

  return rows;
}

async function coldRows() {
  const rows = [];

  for (const framework of FRAMEWORKS) {
    const runs = [];

    for (let run = 0; run < COLD_RUNS; run += 1) {
      runs.push(await coldStart(framework));
    }

    rows.push([framework, median(runs).toFixed(0)]);
  }

  return rows;
}

/** Starts one server in a process of its own, warms it and the client up, then measures a second round of requests. */
async function load(framework, mode) {
  const server = await startServer(framework, mode, 1);

  await send(server.url, WARM_UP);

  const started = performance.now();
  const latencies = await send(server.url, REQUESTS);
  const elapsed = performance.now() - started;

  server.stop();
  latencies.sort((a, b) => a - b);

  return { rate: (REQUESTS * 1000) / elapsed, p99: latencies[Math.floor(latencies.length * 0.99)] ?? 0 };
}

/** `count` requests, `CONCURRENCY` at a time: the latency of each. */
async function send(url, count) {
  const latencies = [];
  let sent = 0;

  const worker = async () => {
    while (sent < count) {
      sent += 1;

      const before = performance.now();
      const response = await fetch(`${url}/r0`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(VALID_BODY),
      });

      await response.arrayBuffer();
      latencies.push(performance.now() - before);
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  return latencies;
}

/** From the spawn of a process to the first answer of one of its routes. */
async function coldStart(framework) {
  const started = performance.now();
  const server = await startServer(framework, 'kit', COLD_ROUTES);
  const response = await fetch(`${server.url}/r0`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(VALID_BODY),
  });

  await response.arrayBuffer();

  const elapsed = performance.now() - started;

  server.stop();

  return elapsed;
}

function startServer(framework, mode, routes) {
  const child = spawn(process.execPath, ['--input-type=module', '--eval', serverSource(framework, mode, routes)], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'inherit'],
  });

  return new Promise((resolve, reject) => {
    child.stdout.once('data', (data) =>
      resolve({ url: `http://127.0.0.1:${String(data).trim()}`, stop: () => child.kill() }),
    );
    child.once('exit', (code) => reject(new Error(`The ${framework} server stopped with ${String(code)}.`)));
  });
}

/** The program of a server: `routes` command routes with the zod body, mounted by the kit, or one bare handler. */
function serverSource(framework, mode, routes) {
  const kitRoutes = `
    import { z } from 'zod';
    import { acceptedSchema, defineRoute, executeRoute } from '@ddd-ts-kit/http';
    import { zodSchema } from '@ddd-ts-kit/validation/zod';
    const slot = z.object({ startsAt: z.iso.datetime(), endsAt: z.iso.datetime() }).meta({ id: 'Slot' });
    const body = zodSchema(z.object({ patientId: z.uuid(), reason: z.string().max(500).optional(), slot }));
    const routes = Array.from({ length: ${routes} }, (_unused, index) => defineRoute(
      { method: 'POST', path: '/r' + index, operationId: 'r' + index, summary: 'Measure', request: { body },
        responses: { 201: { description: 'Done.', body: acceptedSchema } }, security: false },
      () => ({ status: 201, body: { id: 'a-1' } }),
    ));`;

  return `${mode === 'kit' ? kitRoutes : ''}\n${SERVERS[framework][mode]}`;
}

const SERVERS = {
  express: {
    kit: `import express from 'express'; import { mountExpress } from '@ddd-ts-kit/http/express';
      const app = express(); app.use(express.json()); mountExpress(app, routes);
      const server = app.listen(0, '127.0.0.1', () => console.log(server.address().port));`,
    bare: `import express from 'express';
      const app = express(); app.use(express.json());
      app.post('/r0', (request, response) => { response.status(201).json({ id: 'a-1' }); });
      const server = app.listen(0, '127.0.0.1', () => console.log(server.address().port));`,
  },
  fastify: {
    kit: `import Fastify from 'fastify'; import { mountFastify } from '@ddd-ts-kit/http/fastify';
      const app = Fastify(); mountFastify(app, routes);
      await app.listen({ port: 0, host: '127.0.0.1' }); console.log(app.server.address().port);`,
    bare: `import Fastify from 'fastify';
      const app = Fastify(); app.post('/r0', async (request, reply) => reply.code(201).send({ id: 'a-1' }));
      await app.listen({ port: 0, host: '127.0.0.1' }); console.log(app.server.address().port);`,
  },
  hono: {
    kit: `import { serve } from '@hono/node-server'; import { Hono } from 'hono'; import { mountHono } from '@ddd-ts-kit/http/hono';
      const app = new Hono(); mountHono(app, routes);
      const server = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' }, (info) => console.log(info.port));`,
    bare: `import { serve } from '@hono/node-server'; import { Hono } from 'hono';
      const app = new Hono(); app.post('/r0', async (context) => { await context.req.json(); return context.json({ id: 'a-1' }, 201); });
      serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' }, (info) => console.log(info.port));`,
  },
  nest: {
    kit: `import 'reflect-metadata'; import { Module } from '@nestjs/common'; import { NestFactory } from '@nestjs/core';
      import { createRoutesModule } from '@ddd-ts-kit/http/nest';
      class AppModule {} Module({ imports: [createRoutesModule(routes)] })(AppModule);
      const app = await NestFactory.create(AppModule, { logger: false }); await app.listen(0, '127.0.0.1');
      console.log(app.getHttpServer().address().port);`,
  },
};

function commandRoute(routePath, body) {
  return defineRoute(
    {
      method: 'POST',
      path: routePath,
      operationId: routePath.slice(1),
      summary: 'Measure',
      ...(body === undefined ? {} : { request: { body } }),
      responses: { 201: { description: 'Done.', body: acceptedSchema } },
      security: false,
    },
    () => ({ status: 201, body: { id: 'a-1' } }),
  );
}

function zodBody() {
  const slot = z.object({ startsAt: z.iso.datetime(), endsAt: z.iso.datetime() }).meta({ id: 'Slot' });

  return zodSchema(z.object({ patientId: z.uuid(), reason: z.string().max(500).optional(), slot }));
}

function typeboxBody() {
  const slot = Type.Object(
    { startsAt: Type.String({ format: 'date-time' }), endsAt: Type.String({ format: 'date-time' }) },
    { $id: 'Slot' },
  );

  return typeboxSchema(
    Type.Object({
      patientId: Type.String({ format: 'uuid' }),
      reason: Type.Optional(Type.String({ maxLength: 500 })),
      slot,
    }),
  );
}

/** The decorators applied by hand: this script is plain JavaScript. */
function classBody() {
  class SlotDto {}
  class BookBody {}

  IsISO8601()(SlotDto.prototype, 'startsAt');
  IsISO8601()(SlotDto.prototype, 'endsAt');
  IsUUID()(BookBody.prototype, 'patientId');
  IsOptional()(BookBody.prototype, 'reason');
  IsString()(BookBody.prototype, 'reason');
  MaxLength(500)(BookBody.prototype, 'reason');
  ValidateNested()(BookBody.prototype, 'slot');
  Nested(() => SlotDto)(BookBody.prototype, 'slot');

  return classSchema(BookBody, { shared: true });
}

function timed(work) {
  const started = performance.now();

  work();

  return performance.now() - started;
}

function repeat(times, work) {
  return Array.from({ length: times }, work);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);

  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function table(title, header, rows) {
  const line = (cells) => `| ${cells.join(' | ')} |`;

  return [`### ${title}`, '', line(header), line(header.map(() => '---')), ...rows.map(line), ''].join('\n');
}

// Last: the constants above are initialised by the time it runs.
await main();
