import { createHmac } from 'node:crypto';
import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { createErrorMapper } from '../src';
import { createControllersModule } from '../src/nest';
import { AlertsController, WEBHOOK_SECRET } from './support/nest-alerts';
import { callerOf, InvoicesController, LEDGER, type Ledger } from './support/nest-invoices';

const PLATFORMS: readonly (readonly [string, () => FastifyAdapter | undefined])[] = [
  ['Express', () => undefined],
  ['Fastify', () => new FastifyAdapter()],
];

describe.each(PLATFORMS)('a Nest controller served by the kit, on Nest over %s', (_platform, adapterOf) => {
  const ledger: Ledger = { issued: [] };
  let app: INestApplication;
  let url: string;

  beforeAll(async () => {
    const module = createControllersModule([InvoicesController, AlertsController], {
      providers: [{ provide: LEDGER, useValue: ledger }],
      schemaOfClass: classSchema,
      resolvePrincipal: callerOf,
      errorMapper: createErrorMapper({ INVOICE_ALREADY_ISSUED: 409 }),
    });

    const adapter = adapterOf();
    const options = { logger: false as const, abortOnError: false };

    app =
      adapter === undefined
        ? await NestFactory.create(module, { ...options, rawBody: true })
        : await NestFactory.create(module, adapter, { ...options, rawBody: true });

    await app.listen(0, '127.0.0.1');
    url = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  });

  afterAll(async () => {
    await app.close();
  });

  const issue = (invoiceId: string, body: unknown, authorization?: string): Promise<Response> =>
    fetch(`${url}/invoices/${invoiceId}/issue`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(authorization === undefined ? {} : { authorization }) },
      body: JSON.stringify(body),
    });

  it('runs the method built by Nest with its parameters, its caller and the status Nest gives a POST', async () => {
    const response = await issue('inv-1', { customerId: 'c-1' }, 'Bearer ada');

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ invoiceId: 'inv-1', customerId: 'c-1', issuedBy: 'ada' });
    expect(response.headers.get('location')).toBe('/invoices/inv-1');
    expect(ledger.issued).toContain('inv-1');
  });

  it('hands a method that declares rawBody the bytes as they were sent, to verify a signature over them', async () => {
    const payload = '{ "title":  "Disk full",   "severity": "high" }';
    const sign = (body: string): string => createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');

    const send = (signature: string): Promise<Response> =>
      fetch(`${url}/alerts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-signature': signature },
        body: payload,
      });

    const signed = await send(sign(payload));
    const forged = await send(sign('{}'));

    expect(signed.status).toBe(200);
    expect(await signed.json()).toEqual({ title: 'Disk full' });
    expect(forged.status).toBe(422);
    expect(await forged.json()).toMatchObject({ code: 'BAD_SIGNATURE' });
  });

  it('refuses an anonymous caller with the guards of @KitRoutes, before the method runs', async () => {
    const response = await issue('inv-2', { customerId: 'c-1' });

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'UNAUTHORIZED' });
    expect(ledger.issued).not.toContain('inv-2');
  });

  it('validates the body with its DTO class, as a problem document with the issues', async () => {
    const response = await issue('inv-3', { customerId: '' }, 'Bearer ada');

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: 'VALIDATION_FAILED', issues: [{ path: 'body.customerId' }] });
  });

  it('answers a refusal of the method as a problem document with its code', async () => {
    await issue('inv-4', { customerId: 'c-1' }, 'Bearer ada');

    const response = await issue('inv-4', { customerId: 'c-1' }, 'Bearer ada');

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'INVOICE_ALREADY_ISSUED' });
  });

  it('reads the parts a method names one by one: a query parameter, a header in any case', async () => {
    const response = await fetch(`${url}/invoices?page=2`, {
      headers: { authorization: 'Bearer ada', 'x-reason': 'audit' },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ page: '2', reason: 'audit' });
  });
});
