import { z } from 'zod';
import { ConflictError, DomainError, NotFoundError } from '@ddd-ts-kit/kernel';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { defineRoute, type Route } from '../../src/index.js';

export class OrderAlreadyShipped extends DomainError {
  readonly code = 'ORDER_ALREADY_SHIPPED';
}

export const SECRET = 'connection string postgres://admin:hunter2@db';

const orderParams = zodSchema(z.object({ orderId: z.string().uuid() }));

const orderBody = zodSchema(
  z.object({
    customerId: z.string().min(1),
    items: z.array(z.object({ sku: z.string().min(1), quantity: z.number().int().positive() })).min(1),
  }),
);

const order = zodSchema(
  z.object({ id: z.string(), customerId: z.string(), lines: z.number().int() }),
  { io: 'output' },
);

export const KNOWN_ORDER = '0b8f6e0e-2f4b-4c58-9c0e-6f1d2a3b4c5d';
export const SHIPPED_ORDER = '11111111-1111-4111-8111-111111111111';
export const BROKEN_ORDER = '22222222-2222-4222-8222-222222222222';

export const placeOrder = defineRoute(
  {
    method: 'POST',
    path: '/orders',
    operationId: 'placeOrder',
    summary: 'Place an order',
    tags: ['orders'],
    request: { body: orderBody },
    responses: { 201: { description: 'The order was placed.', body: order } },
    errors: ['CONFLICT'],
  },
  ({ body, context }) => ({
    status: 201,
    body: { id: KNOWN_ORDER, customerId: body.customerId, lines: body.items.length },
    headers: { Location: `/orders/${KNOWN_ORDER}`, 'X-Seen-Request': context.requestId },
  }),
);

export const getOrder = defineRoute(
  {
    method: 'GET',
    path: '/orders/:orderId',
    operationId: 'getOrder',
    summary: 'Read an order',
    tags: ['orders'],
    request: {
      params: orderParams,
      query: zodSchema(z.object({ expand: z.enum(['lines']).optional() })),
    },
    responses: { 200: { description: 'The order.', body: order } },
    errors: ['NOT_FOUND', 'ORDER_ALREADY_SHIPPED', 'CONFLICT'],
  },
  ({ params, query }) => {
    if (params.orderId === SHIPPED_ORDER) {
      throw new OrderAlreadyShipped('The order has already been shipped.');
    }
    if (params.orderId === BROKEN_ORDER) {
      throw new Error(SECRET);
    }
    if (params.orderId !== KNOWN_ORDER) {
      throw new NotFoundError(`Order ${params.orderId} does not exist.`);
    }
    return {
      status: 200,
      body: { id: params.orderId, customerId: 'c-1', lines: query.expand === 'lines' ? 2 : 0 },
    };
  },
);

export const cancelOrder = defineRoute(
  {
    method: 'DELETE',
    path: '/orders/:orderId',
    operationId: 'cancelOrder',
    summary: 'Cancel an order',
    tags: ['orders'],
    request: { params: orderParams },
    responses: { 204: { description: 'The order was cancelled.' } },
    errors: ['NOT_FOUND', 'CONFLICT'],
    security: ['bearer'],
  },
  ({ params }) => {
    if (params.orderId === SHIPPED_ORDER) {
      throw new ConflictError('A shipped order cannot be cancelled.');
    }
    return { status: 204 };
  },
);

export const whoAmI = defineRoute(
  {
    method: 'GET',
    path: '/me',
    operationId: 'whoAmI',
    summary: 'Read the caller',
    responses: { 200: { description: 'The caller.', body: zodSchema(z.object({ principal: z.unknown() })) } },
    security: ['bearer'],
  },
  ({ context }) => ({ status: 200, body: { principal: context.principal ?? null } }),
);

export const orderRoutes: readonly Route[] = [placeOrder, getOrder, cancelOrder, whoAmI];
