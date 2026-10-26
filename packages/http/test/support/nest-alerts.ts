import 'reflect-metadata';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Controller, Post } from '@nestjs/common';
import { DomainError, ok } from '@ddd-ts-kit/kernel';
import { customSchema } from '@ddd-ts-kit/validation';
import { Public, type RequestContext } from '../../src';
import { KitRoute, KitRoutes, RouteContext } from '../../src/nest';

export const WEBHOOK_SECRET = 'whsec-nest';

class BadSignature extends DomainError {
  readonly code = 'BAD_SIGNATURE';
}

const ACCEPTED = customSchema((input) => ok(input), { type: 'object', properties: { title: { type: 'string' } } });

/** A webhook signed over the bytes it was sent in, read by a Nest controller as they arrived. */
export class AlertsController {
  async receive(context: RequestContext): Promise<{ title: string }> {
    const bytes: Buffer[] = [];

    for await (const chunk of context.stream ?? []) {
      bytes.push(Buffer.from(chunk));
    }

    const body = Buffer.concat(bytes);
    const given = Buffer.from(String(context.rawHeaders?.['x-signature'] ?? ''));
    const expected = Buffer.from(createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex'));

    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw new BadSignature('The signature does not match the body.');
    }

    return { title: JSON.parse(body.toString('utf8')).title };
  }
}

const prototype = AlertsController.prototype;

Controller('alerts')(AlertsController);
KitRoutes({ guards: [Public] })(AlertsController);

Reflect.decorate(
  [
    Post(),
    KitRoute({
      operationId: 'receiveAlert',
      summary: 'Receive an alert',
      rawBody: true,
      errors: ['BAD_SIGNATURE'],
      response: { status: 200, body: ACCEPTED },
    }),
  ],
  prototype,
  'receive',
  { value: prototype.receive },
);

RouteContext()(prototype, 'receive', 0);
Reflect.defineMetadata('design:paramtypes', [Object], prototype, 'receive');
