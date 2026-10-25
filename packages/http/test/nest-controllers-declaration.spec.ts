import 'reflect-metadata';
import { Body, Controller, Module, Param, Post, Req, UseGuards } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { DeclarationError } from '@ddd-ts-kit/kernel/declarations';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { createErrorMapper, Public } from '../src';
import { createControllersModule, KitRoute, nestControllerRoutes } from '../src/nest';
import { generateOpenApi } from '../src/openapi';
import { orpcRouter } from '../src/orpc';
import { InvoicesController, LEDGER } from './support/nest-invoices';

/** A Nest controller with one method, `act`, its decorators applied by calls as TypeScript would. */
function controllerWith(
  decorators: readonly MethodDecorator[],
  parameters: (prototype: object) => void = () => undefined,
): new () => object {
  class Acting {
    act(): void {}
  }

  Controller('acting')(Acting);

  Reflect.decorate(
    [Post(), KitRoute({ operationId: 'act', summary: 'Act', guards: [Public] }), ...decorators],
    Acting.prototype,
    'act',
    { value: Acting.prototype.act },
  );

  parameters(Acting.prototype);

  return Acting;
}

describe('the routes of Nest controllers, as the kit reads them', () => {
  it('document each method in the contract, without an instance: path, parameters, body, codes, tags, security', () => {
    const document = generateOpenApi({
      info: { title: 'Invoicing', version: '1.0.0' },
      routes: nestControllerRoutes([InvoicesController], { schemaOfClass: classSchema }),
      errorMapper: createErrorMapper({ INVOICE_ALREADY_ISSUED: 409 }),
    });

    const issue = document.paths['/invoices/{invoiceId}/issue']?.['post'];

    expect(issue).toMatchObject({
      operationId: 'issueInvoice',
      tags: ['Invoices'],
      security: [{ bearer: [] }],
      parameters: [{ name: 'invoiceId', in: 'path', required: true }],
      requestBody: { required: true },
    });

    expect(JSON.stringify(issue?.responses)).toContain('INVOICE_ALREADY_ISSUED');
    expect(JSON.stringify(issue?.responses)).toContain('UNAUTHORIZED');
    expect(Object.keys(issue?.responses ?? {})).toContain('201');
  });

  it('are served over /rpc too, as every route of the kit', () => {
    const routes = nestControllerRoutes([InvoicesController], { schemaOfClass: classSchema });

    expect(Object.keys(orpcRouter(routes)).sort()).toEqual(['issueInvoice', 'searchInvoices']);
  });
});

describe('a Nest controller the kit refuses to serve', () => {
  it.each([
    ['a guard of Nest, which the kit does not run', [UseGuards(class {})], undefined, /@UseGuards/],
    [
      'the request of Nest, which bypasses what the kit validates',
      [],
      (prototype: object) => Req()(prototype, 'act', 0),
      /is @REQUEST of Nest/,
    ],
    [
      'a body taken whole without a class',
      [],
      (prototype: object) => {
        Body()(prototype, 'act', 0);
        Reflect.defineMetadata('design:paramtypes', [Object], prototype, 'act');
      },
      /takes the whole body and has no class/,
    ],
    [
      'a path parameter typed as a number',
      [],
      (prototype: object) => {
        Param('page')(prototype, 'act', 0);
        Reflect.defineMetadata('design:paramtypes', [Number], prototype, 'act');
      },
      /is one params part, a text/,
    ],
  ])('refuses %s, when its routes are built', (_what, decorators, parameters, message) => {
    const controller = controllerWith(decorators, parameters);

    expect(() => nestControllerRoutes([controller])).toThrow(DeclarationError);
    expect(() => nestControllerRoutes([controller])).toThrow(message);
  });

  it('refuses a route that names no guard, here or on its controller: nothing is open by omission', () => {
    class Open {
      act(): void {}
    }

    Controller('open')(Open);

    Reflect.decorate([Post(), KitRoute({ operationId: 'open', summary: 'Open' })], Open.prototype, 'act', {
      value: Open.prototype.act,
    });

    expect(() => nestControllerRoutes([Open])).toThrow(/nothing says who may call it/);
  });

  it('refuses a DTO class when nothing reads it, and a class that is no Nest controller', () => {
    expect(() => nestControllerRoutes([InvoicesController])).toThrow(/give schemaOfClass/);
    expect(() => nestControllerRoutes([class NotAController {}])).toThrow(/carries no @Controller of Nest/);
  });

  it('refuses to start when the controller is also among the controllers of a Nest module', async () => {
    class Routed {}

    Module({ controllers: [InvoicesController], providers: [{ provide: LEDGER, useValue: { issued: [] } }] })(Routed);

    const served = createControllersModule([InvoicesController], {
      imports: [Routed],
      providers: [{ provide: LEDGER, useValue: { issued: [] } }],
      schemaOfClass: classSchema,
    });

    const app = await NestFactory.create(served, { logger: false, abortOnError: false });

    await expect(app.init()).rejects.toThrow(/is in the controllers of the Nest module Routed/);
    await app.close();
  });

  it('starts next to the plain Nest controllers of the platform, with the security schemes of the application', async () => {
    class Health {}
    class Platform {}

    Controller('health')(Health);
    Module({ controllers: [Health] })(Platform);

    const served = createControllersModule([controllerWith([])], { imports: [Platform], security: ['apiKey'] });
    const app = await NestFactory.create(served, { logger: false, abortOnError: false });

    await app.init();
    await app.close();
  });
});
