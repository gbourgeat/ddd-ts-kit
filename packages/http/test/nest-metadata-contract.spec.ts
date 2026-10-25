import 'reflect-metadata';
import { Body, Controller, Headers, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import {
  GUARDS_METADATA,
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
  ROUTE_ARGS_METADATA,
} from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';

/**
 * What the decorators of the installed Nest write, as `src/nest/controllers/nest-route-metadata.ts`
 * reads it. The bridge depends on these keys and this shape, which Nest exports for its own router
 * and does not promise to keep: a release of Nest that changes them fails here, in the pipeline of
 * the kit, before a project upgrades to it.
 */
class Invoices {
  issue(): void {}
}

Controller('invoices')(Invoices);

Reflect.decorate([Post(':invoiceId/issue'), HttpCode(202), UseGuards(class {})], Invoices.prototype, 'issue', {
  value: Invoices.prototype.issue,
});

Param('invoiceId')(Invoices.prototype, 'issue', 0);
Body()(Invoices.prototype, 'issue', 1);
Query('page')(Invoices.prototype, 'issue', 2);
Headers('x-reason')(Invoices.prototype, 'issue', 3);
Req()(Invoices.prototype, 'issue', 4);

describe('the metadata Nest writes, as the kit reads it', () => {
  it('keeps the path of the controller and of the method under "path", the method as a number under "method"', () => {
    expect([PATH_METADATA, METHOD_METADATA, HTTP_CODE_METADATA, GUARDS_METADATA]).toEqual([
      'path',
      'method',
      '__httpCode__',
      '__guards__',
    ]);

    expect(Reflect.getMetadata(PATH_METADATA, Invoices)).toBe('invoices');
    expect(Reflect.getMetadata(PATH_METADATA, Invoices.prototype.issue)).toBe(':invoiceId/issue');
    expect(Reflect.getMetadata(METHOD_METADATA, Invoices.prototype.issue)).toBe(1);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, Invoices.prototype.issue)).toBe(202);
    expect(Reflect.getMetadata(GUARDS_METADATA, Invoices.prototype.issue)).toHaveLength(1);
  });

  it('keeps each parameter under "<type>:<index>" of "__routeArguments__", on the class, with its index, its name and its pipes', () => {
    expect(ROUTE_ARGS_METADATA).toBe('__routeArguments__');

    expect(Reflect.getMetadata(ROUTE_ARGS_METADATA, Invoices, 'issue')).toEqual({
      '5:0': { index: 0, data: 'invoiceId', pipes: [] },
      '3:1': { index: 1, data: undefined, pipes: [] },
      '4:2': { index: 2, data: 'page', pipes: [] },
      '6:3': { index: 3, data: 'x-reason', pipes: [] },
      '0:4': { index: 4, data: undefined, pipes: [] },
    });
  });
});
