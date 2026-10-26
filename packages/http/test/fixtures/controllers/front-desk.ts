import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { DomainError, err, ok } from '@ddd-ts-kit/kernel';
import { customSchema } from '@ddd-ts-kit/validation';
import { standardSchema } from '@ddd-ts-kit/validation/standard-schema';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import {
  Authenticated,
  Controller,
  ForbiddenError,
  Guard,
  HasRole,
  Public,
  RequestMapper,
  RouteGroup,
  Serializer,
  type GuardRequest,
  type HttpRequest,
} from '../../../src';

/** A port of the fixture: what the composition root injects by its class. */
export abstract class Desk {
  abstract book(visit: Visit): string;

  abstract visitOf(id: string): StoredVisit;
}

export interface Visit {
  readonly patientId: string;
  readonly day: string;
  readonly bookedBy: string;
}

export interface StoredVisit extends Visit {
  readonly id: string;
  readonly internalNote: string;
}

interface BookVisitBody {
  readonly patientId: string;
  readonly day: string;
}

interface VisitView {
  readonly id: string;
  readonly patientId: string;
  readonly day: string;
}

const bookVisitBody = zodSchema(z.object({ patientId: z.string().min(1), day: z.string().date() }));
const booked = zodSchema(z.object({ id: z.string() }), { io: 'output' });
const visitParams = standardSchema(z.object({ visitId: z.string().min(1) }));

const visitView = customSchema<VisitView>(
  (input) =>
    typeof input === 'object' && input !== null && 'id' in input
      ? ok(input as VisitView)
      : err([{ path: '', code: 'invalid_type', message: 'Expected a visit.' }]),
  { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
);

@RouteGroup({ prefix: '/visits', tags: ['visits'], guards: [Authenticated], errors: ['FORBIDDEN'] })
export class VisitRoutes {}

/** Refuses a caller of another clinic than the one of the path: a guard of the project, built by the composition root. */
@Guard()
export class SameClinicGuard implements Guard {
  readonly documents = { errors: ['FORBIDDEN'] };

  constructor(private readonly desk: Desk) {}

  check({ actor, params }: GuardRequest): void {
    if (this.desk !== undefined && actor.tenantId !== params['clinicId']) {
      throw new ForbiddenError('The caller belongs to another clinic');
    }
  }
}

@RouteGroup({ parent: VisitRoutes, prefix: '/clinics/:clinicId', guards: [HasRole('manager'), SameClinicGuard] })
export class ClinicVisitRoutes {}

@RequestMapper()
export class BookVisitMapper implements RequestMapper<HttpRequest<{ body: BookVisitBody }>, Visit> {
  map({ body, actor }: HttpRequest<{ body: BookVisitBody }>): Visit {
    return { patientId: body.patientId, day: body.day, bookedBy: actor.id };
  }
}

@Serializer()
export class VisitSerializer implements Serializer<StoredVisit, VisitView> {
  serialize({ id, patientId, day }: StoredVisit): VisitView {
    return { id, patientId, day };
  }
}

@Controller({
  group: VisitRoutes,
  method: 'POST',
  path: '/',
  summary: 'Book visit',
  body: bookVisitBody,
  response: {
    status: 201,
    description: 'Booked; the body carries the identifier.',
    body: booked,
    headers: { Location: 'The URL of the visit.' },
  },
  errors: ['SLOT_TAKEN'],
})
export class BookVisitController {
  constructor(
    private readonly desk: Desk,
    private readonly mapper: BookVisitMapper,
  ) {}

  async handle(request: HttpRequest<{ body: BookVisitBody }>) {
    const id = this.desk.book(this.mapper.map(request));

    return { body: { id }, headers: { Location: `/visits/${id}` } };
  }
}

@Controller({
  group: VisitRoutes,
  method: 'GET',
  path: '/:visitId',
  summary: 'Get visit',
  params: visitParams,
  response: { status: 200, body: visitView },
})
export class GetVisitController {
  constructor(
    private readonly desk: Desk,
    private readonly serializer: VisitSerializer,
  ) {}

  handle({ params }: HttpRequest<{ params: { visitId: string } }>): VisitView {
    return this.serializer.serialize(this.desk.visitOf(params.visitId));
  }
}

@Controller({
  group: ClinicVisitRoutes,
  method: 'DELETE',
  path: '/visits/:visitId',
  summary: 'Cancel visit',
  response: { status: 204 },
})
export class CancelVisitController {
  static cancelled: string[] = [];

  handle({ params }: HttpRequest): void {
    CancelVisitController.cancelled.push(String(params['visitId']));
  }
}

@Controller({
  method: 'GET',
  path: '/opening-hours',
  operationId: 'readOpeningHours',
  summary: 'Read the opening hours',
  tags: ['public'],
  guards: [Public],
  response: { status: 200, body: zodSchema(z.object({ opens: z.string() }), { io: 'output' }) },
  deprecated: true,
})
export class OpeningHoursController {
  handle(): { opens: string } {
    return { opens: '08:00' };
  }
}

/** The secret a monitoring tool signs its alerts with. */
export const WEBHOOK_SECRET = 'whsec-test';

/** A webhook signed over the bytes it was sent in: the controller reads them as they arrived, before any parsing. */
@Controller({
  method: 'POST',
  path: '/alerts',
  operationId: 'receiveAlert',
  summary: 'Receive an alert',
  guards: [Public],
  rawBody: true,
  errors: ['BAD_SIGNATURE'],
  response: { status: 200, body: zodSchema(z.object({ title: z.string() }), { io: 'output' }) },
})
export class ReceiveAlertController {
  async handle({ context }: HttpRequest<{ rawBody: true }>): Promise<{ title: string }> {
    const bytes: Buffer[] = [];

    for await (const chunk of context.stream) {
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

class BadSignature extends DomainError {
  readonly code = 'BAD_SIGNATURE';
}
