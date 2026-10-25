import 'reflect-metadata';
import { Readable } from 'node:stream';
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ok } from '@ddd-ts-kit/kernel';
import { customSchema } from '@ddd-ts-kit/validation';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { executeRoute, Public, type Route } from '../src';
import {
  CurrentActor,
  KitRoute,
  KitRoutes,
  nestControllerRoute,
  nestControllerRoutes,
  RouteContext,
  Upload,
  withSignatures,
} from '../src/nest';
import type { NestControllerRoutesOptions } from '../src/nest';
import { IssueInvoiceBody } from './support/nest-invoices';

class Reading {
  read(page: string | undefined, context: { requestId?: string }, actor: { type: string }): object {
    return { page: page ?? null, requestId: typeof context.requestId, caller: actor.type };
  }
}

Controller('reading')(Reading);

Reflect.decorate(
  [
    Get(),
    KitRoute({
      operationId: 'read',
      summary: 'Read',
      guards: [Public],
      response: { body: customSchema((input) => ok(input)) },
    }),
  ],
  Reading.prototype,
  'read',
  { value: Reading.prototype.read },
);

Query('page')(Reading.prototype, 'read', 0);
RouteContext()(Reading.prototype, 'read', 1);
CurrentActor()(Reading.prototype, 'read', 2);

function routeOf(options: NestControllerRoutesOptions): Route {
  const [route] = nestControllerRoutes([Reading], options);

  if (route === undefined) {
    throw new Error('Reading declares one route.');
  }

  return route;
}

const read = (route: Route, query: Record<string, unknown> = {}) =>
  executeRoute(route, { params: {}, query, headers: {}, body: undefined, raw: {} });

describe('a call of a route of a Nest controller', () => {
  it('hands the method the context of the request and its caller, anonymous here', async () => {
    const answer = await read(routeOf({ instanceOf: () => new Reading() }), { page: '3' });

    expect(answer).toMatchObject({ status: 200, body: { page: '3', requestId: 'string', caller: 'anonymous' } });
  });

  it('leaves out a query parameter the caller did not send, and refuses one sent twice', async () => {
    const route = routeOf({ instanceOf: () => new Reading() });

    expect(await read(route)).toMatchObject({ status: 200, body: { page: null } });
    expect(await read(route, { page: ['1', '2'] })).toMatchObject({ status: 422, body: { code: 'VALIDATION_FAILED' } });
  });

  it('answers 500 when nothing builds the controller, or what is built lacks the method', async () => {
    expect(await read(routeOf({}))).toMatchObject({ status: 500, body: { code: 'INTERNAL_ERROR' } });
    expect(await read(routeOf({ instanceOf: () => ({}) }))).toMatchObject({ status: 500 });
  });

  it('builds the instance once, at the first call', async () => {
    let built = 0;

    const route = routeOf({
      instanceOf: () => {
        built += 1;

        return new Reading();
      },
    });

    expect(built).toBe(0);

    await read(route);
    await read(route);

    expect(built).toBe(1);
  });

  it('refuses a method that returns a value its @KitRoute declares no body for, rather than answer it empty', async () => {
    class Issuing {
      async issue(): Promise<object> {
        return { id: 'inv-1' };
      }
    }

    Controller('issuing')(Issuing);

    Reflect.decorate(
      [Post(), KitRoute({ operationId: 'issue', summary: 'Issue', guards: [Public] })],
      Issuing.prototype,
      'issue',
      { value: Issuing.prototype.issue },
    );

    Reflect.defineMetadata('design:returntype', Promise, Issuing.prototype, 'issue');

    const errors: unknown[] = [];
    const [route] = nestControllerRoutes([Issuing], { instanceOf: () => new Issuing() });

    if (route === undefined) {
      throw new Error('Issuing declares one route.');
    }

    const answer = await executeRoute(
      route,
      { params: {}, query: {}, headers: {}, body: undefined, raw: {} },
      { onError: (error) => errors.push(error) },
    );

    expect(answer).toMatchObject({ status: 500, body: { code: 'INTERNAL_ERROR' } });
    expect(String(errors[0])).toContain('returned a value and @KitRoute declares no response.body');
  });

  it('refuses it when the routes are built, when TypeScript recorded what the method returns', () => {
    class Invoice {}
    class Reporting {
      report(): Invoice {
        return new Invoice();
      }
    }

    Controller('reporting')(Reporting);

    Reflect.decorate(
      [Get(), KitRoute({ operationId: 'report', summary: 'Report', guards: [Public] })],
      Reporting.prototype,
      'report',
      { value: Reporting.prototype.report },
    );

    Reflect.defineMetadata('design:returntype', Invoice, Reporting.prototype, 'report');

    expect(() => nestControllerRoutes([Reporting])).toThrow(/returns Invoice and @KitRoute declares no response.body/);
  });

  it('answers the body its signature names, as ddd-ts-kit read it into withSignatures, with no @KitRoute at all', async () => {
    class Summing {
      async total(): Promise<object> {
        return { total: 3 };
      }
    }

    Controller('summing')(Summing);
    KitRoutes({ guards: [Public] })(Summing);
    Reflect.decorate([Get()], Summing.prototype, 'total', { value: Summing.prototype.total });
    withSignatures(Summing, { total: { answer: customSchema((input) => ok(input), { type: 'object' }) } });

    const route = nestControllerRoute(Summing, { instanceOf: () => new Summing() });

    expect(route.responses).toMatchObject({ 200: { body: expect.any(Object) } });
    expect(await read(route)).toMatchObject({ status: 200, body: { total: 3 } });
  });
});

describe('a call of a route of a Nest controller, by what its signature and @KitRoute declare', () => {
  it('validates a body taken whole by the class its signature names, with no metadata of TypeScript nor request in @KitRoute', async () => {
    class Filing {
      file(body: IssueInvoiceBody): void {
        expect(body).toBeInstanceOf(IssueInvoiceBody);
      }
    }

    Controller('filing')(Filing);
    KitRoutes({ guards: [Public] })(Filing);
    Reflect.decorate([Post()], Filing.prototype, 'file', { value: Filing.prototype.file });
    Body()(Filing.prototype, 'file', 0);
    withSignatures(Filing, { file: { body: IssueInvoiceBody, answer: null } });

    const route = nestControllerRoute(Filing, { instanceOf: () => new Filing(), schemaOfClass: classSchema });
    const call = (body: unknown) => executeRoute(route, { params: {}, query: {}, headers: {}, body, raw: {} });

    expect(await call({ customerId: 'c-1' })).toMatchObject({ status: 201 });
    expect(await call({ customerId: '' })).toMatchObject({ status: 422 });
  });

  it('hands @Upload() the file the kit streamed, as @KitRoute declares it', async () => {
    class Receiving {
      receive(file: { fileName: string }): { fileName: string } {
        return { fileName: file.fileName };
      }
    }

    Controller('receipts')(Receiving);
    KitRoutes({ guards: [Public] })(Receiving);

    Reflect.decorate(
      [
        Post(),
        KitRoute({
          upload: { field: 'file', maxBytes: 64, mediaTypes: ['application/pdf'] },
          response: { body: customSchema((input) => ok(input)) },
        }),
      ],
      Receiving.prototype,
      'receive',
      { value: Receiving.prototype.receive },
    );

    Upload()(Receiving.prototype, 'receive', 0);

    const route = nestControllerRoute(Receiving, { instanceOf: () => new Receiving() });
    const file = { fileName: 'receipt.pdf', mediaType: 'application/pdf', stream: Readable.from([]) };

    const answer = await executeRoute(
      route,
      { params: {}, query: {}, headers: {}, body: undefined, raw: {} },
      { uploads: () => Promise.resolve({ fields: {}, file }) },
    );

    expect(route.upload).toEqual({ field: 'file', maxBytes: 64, mediaTypes: ['application/pdf'] });
    expect(answer).toMatchObject({ status: 201, body: { fileName: 'receipt.pdf' } });
  });

  it('refuses @Upload() on a method whose @KitRoute declares no upload, when its routes are built', () => {
    class Receiving {
      receive(): void {}
    }

    Controller('receipts')(Receiving);
    KitRoutes({ guards: [Public] })(Receiving);
    Reflect.decorate([Post()], Receiving.prototype, 'receive', { value: Receiving.prototype.receive });
    Upload()(Receiving.prototype, 'receive', 0);

    expect(() => nestControllerRoute(Receiving, { instanceOf: () => new Receiving() })).toThrow(
      /takes @Upload\(\) and its @KitRoute declares no upload/,
    );
  });

  it('carries the form and the media types @KitRoute declares onto the route', () => {
    class Entering {
      enter(): void {}
    }

    Controller('entries')(Entering);
    KitRoutes({ guards: [Public] })(Entering);

    Reflect.decorate(
      [Post(), KitRoute({ form: {}, produces: ['application/xml'], consumes: ['application/xml'] })],
      Entering.prototype,
      'enter',
      { value: Entering.prototype.enter },
    );

    expect(nestControllerRoute(Entering, { instanceOf: () => new Entering() })).toMatchObject({
      form: {},
      produces: ['application/xml'],
      consumes: ['application/xml'],
    });
  });
});
