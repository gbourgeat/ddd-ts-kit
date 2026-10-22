import { z } from 'zod';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { Controller, Public, type HttpRequest } from '../../../src';

/*
 * What the compiler refuses. Each case is a class the decorator must reject: the file compiles
 * only as long as every `@ts-expect-error` still meets an error, in both decorator modes.
 */

const body = zodSchema(z.object({ patientId: z.string() }));
const booked = zodSchema(z.object({ id: z.string() }), { io: 'output' });
const route = { method: 'POST', path: '/mistakes', summary: 'A mistake', guards: [Public] } as const;

// @ts-expect-error -- the body is read as another shape than its schema produces
@Controller({ ...route, body, response: { status: 201, body: booked } })
export class ReadsAnotherBodyController {
  handle({ body: read }: HttpRequest<{ body: { patientId: number } }>): { id: string } {
    return { id: String(read.patientId) };
  }
}

// @ts-expect-error -- a body is read and the declaration validates none
@Controller({ ...route, response: { status: 201, body: booked } })
export class ReadsAnUndeclaredBodyController {
  handle({ body: read }: HttpRequest<{ body: { patientId: string } }>): { id: string } {
    return { id: read.patientId };
  }
}

// @ts-expect-error -- another body than the declared response is returned
@Controller({ ...route, body, response: { status: 201, body: booked } })
export class AnswersAnotherBodyController {
  handle(): { identifier: string } {
    return { identifier: 'visit-1' };
  }
}

// @ts-expect-error -- nothing is returned and the declaration answers a body
@Controller({ ...route, body, response: { status: 201, body: booked } })
export class AnswersNothingController {
  handle(): void {}
}

// @ts-expect-error -- a path parameter is read with a type its schema does not produce
@Controller({ ...route, params: zodSchema(z.object({ visitId: z.string() })), response: { status: 204 } })
export class ReadsAnotherParameterController {
  handle({ params }: HttpRequest<{ params: { visitId: number } }>): void {
    void params.visitId;
  }
}

// @ts-expect-error -- a controller answers through `handle`, and this class has none
@Controller({ ...route, response: { status: 204 } })
export class WithoutHandleController {
  execute(): void {}
}
