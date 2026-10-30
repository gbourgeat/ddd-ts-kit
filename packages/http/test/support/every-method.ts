import { z } from 'zod';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { defineRoute, type Route } from '../../src';

const orderId = zodSchema(z.object({ orderId: z.string() }));

/** The methods the order routes leave out, each served alike: an adapter registers every method of HTTP. */
export const annotateOrder = defineRoute(
  {
    method: 'PATCH',
    path: '/orders/:orderId/note',
    operationId: 'annotateOrder',
    summary: 'Annotate an order',
    request: { params: orderId, body: zodSchema(z.object({ note: z.string() })) },
    responses: {
      200: { description: 'Annotated.', body: zodSchema(z.object({ orderId: z.string(), note: z.string() })) },
    },
    security: false,
  },
  ({ params, body }) => ({ status: 200, body: { orderId: params.orderId, note: body.note } }),
);

export const orderPresence = defineRoute(
  {
    method: 'HEAD',
    path: '/orders/:orderId/presence',
    operationId: 'orderPresence',
    summary: 'Whether the order is known',
    request: { params: orderId },
    responses: { 204: { description: 'Known.' } },
    security: false,
  },
  () => ({ status: 204 }),
);

export const orderOptions = defineRoute(
  {
    method: 'OPTIONS',
    path: '/orders/:orderId/presence',
    operationId: 'orderOptions',
    summary: 'What may be asked of the presence',
    request: { params: orderId },
    responses: { 204: { description: 'Allowed.' } },
    security: false,
  },
  () => ({ status: 204 }),
);

/** HEAD and OPTIONS routes: Express registers them as written, where Hono answers a HEAD through the GET of the path. */
export const presenceRoutes: readonly Route[] = [orderPresence, orderOptions];
