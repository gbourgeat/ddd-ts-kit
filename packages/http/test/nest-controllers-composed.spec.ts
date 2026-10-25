import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { executeRoute } from '../src';
import { createRoutesModule, nestControllers, provideControllers } from '../src/nest';
import { callerOf, InvoicesController, LEDGER, type Ledger } from './support/nest-invoices';

/** An application that composes its routes before Nest starts, as a generated one does, and lets Nest build its controllers. */
function composed(ledger: Ledger): ReturnType<typeof nestControllers> {
  return nestControllers([InvoicesController], {
    providers: [{ provide: LEDGER, useValue: ledger }],
    schemaOfClass: classSchema,
  });
}

describe('Nest controllers composed with the other routes of an application', () => {
  it('are served once Nest built them, with what they inject', async () => {
    const ledger: Ledger = { issued: [] };
    const served = composed(ledger);

    class AppModule {}

    Module({
      imports: [createRoutesModule(served.routes, { resolvePrincipal: callerOf }), provideControllers(served)],
    })(AppModule);

    const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });

    await app.listen(0, '127.0.0.1');

    const url = (await app.getUrl()).replace('[::1]', '127.0.0.1');

    const response = await fetch(`${url}/invoices/inv-9/issue`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ada' },
      body: JSON.stringify({ customerId: 'c-1' }),
    });

    expect(response.status).toBe(201);
    expect(ledger.issued).toEqual(['inv-9']);

    await app.close();
  });

  it('refuse a call before Nest started, rather than build a controller by hand', async () => {
    const served = composed({ issued: [] });
    const errors: unknown[] = [];
    const [issue] = served.routes;

    expect(issue?.operationId).toBe('issueInvoice');

    const answer =
      issue === undefined
        ? undefined
        : await executeRoute(
            issue,
            {
              params: { invoiceId: 'inv-1' },
              query: {},
              headers: { 'content-type': 'application/json' },
              body: { customerId: 'c-1' },
              raw: { headers: { authorization: 'Bearer ada' } },
            },
            { resolvePrincipal: callerOf, onError: (error) => errors.push(error) },
          );

    expect(answer).toMatchObject({ status: 500 });
    expect(String(errors[0])).toContain('is called before Nest started');
  });
});
