import 'reflect-metadata';
import { Body, Controller, Get, Module, Param, Post, Req, UseGuards } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { DeclarationError } from '@ddd-ts-kit/kernel/declarations';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { Authenticated, createErrorMapper, Public, RouteGroup } from '../src';
import { createControllersModule, KitRoute, KitRoutes, nestControllerRoute, nestControllerRoutes } from '../src/nest';
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

describe('a Nest controller in a route group of the kit', () => {
  class BillingRoutes {}

  RouteGroup({ prefix: '/billing', tags: ['billing'], guards: [Authenticated], errors: ['FORBIDDEN'] })(BillingRoutes);

  class Statements {
    list(): void {}
  }

  Controller('statements')(Statements);
  KitRoutes({ group: BillingRoutes })(Statements);

  Reflect.decorate(
    [
      Post(':statementId/close'),
      KitRoute({ operationId: 'closeStatement', summary: 'Close a statement', errors: ['STATEMENT_CLOSED'] }),
    ],
    Statements.prototype,
    'list',
    { value: Statements.prototype.list },
  );

  it('takes the prefix, the tags, the guards and the codes of the group, before its own', () => {
    const [route] = nestControllerRoutes([Statements]);

    expect(route).toMatchObject({
      path: '/billing/statements/:statementId/close',
      tags: ['billing'],
      security: ['bearer'],
      groups: ['BillingRoutes'],
    });

    expect(route?.errors).toEqual(expect.arrayContaining(['FORBIDDEN', 'STATEMENT_CLOSED', 'UNAUTHORIZED']));
  });

  it('is the one route nestControllerRoute gives, and a controller of two routes is refused there', () => {
    expect(nestControllerRoute(Statements).operationId).toBe('closeStatement');
    expect(() => nestControllerRoute(InvoicesController, { schemaOfClass: classSchema })).toThrow(/serves 2 routes/);
  });
});

describe('a Nest controller written with the decorators of Nest alone', () => {
  class Reminders {
    sendReminders(): void {}

    notARoute(): void {}
  }

  Controller('reminders')(Reminders);
  KitRoutes({ guards: [Public] })(Reminders);
  Reflect.decorate([Post('send')], Reminders.prototype, 'sendReminders', { value: Reminders.prototype.sendReminders });

  it('is a route of the kit for each method that carries a route decorator of Nest, named after the method', () => {
    const routes = nestControllerRoutes([Reminders]);

    expect(routes.map(({ operationId, summary, path }) => ({ operationId, summary, path }))).toEqual([
      { operationId: 'sendReminders', summary: 'Send reminders', path: '/reminders/send' },
    ]);
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
    class Health {
      check(): { status: string } {
        return { status: 'ok' };
      }
    }

    class Platform {}

    Controller('health')(Health);
    Reflect.decorate([Get()], Health.prototype, 'check', { value: Health.prototype.check });
    Module({ controllers: [Health] })(Platform);

    const served = createControllersModule([controllerWith([])], { imports: [Platform], security: ['apiKey'] });
    const app = await NestFactory.create(served, { logger: false, abortOnError: false });

    await app.listen(0, '127.0.0.1');

    try {
      const answer = await fetch(`${await app.getUrl()}/health`);

      expect(answer.status).toBe(200);
      expect(await answer.json()).toEqual({ status: 'ok' });
    } finally {
      await app.close();
    }
  });
});
