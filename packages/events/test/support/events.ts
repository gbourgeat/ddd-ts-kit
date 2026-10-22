import { z } from 'zod';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { defineIntegrationEvent } from '../../src';

export const orderPlacedV1 = defineIntegrationEvent({
  type: 'ordering.order.placed',
  version: 1,
  description: 'An order was placed. Superseded by version 2.',
  deprecated: true,
  payload: zodSchema(z.object({ orderId: z.string(), total: z.number() })),
});

const money = z.object({ amount: z.number().int(), currency: z.enum(['EUR', 'USD']) }).meta({ id: 'Money' });

export const orderPlacedV2 = defineIntegrationEvent({
  type: 'ordering.order.placed',
  version: 2,
  description: 'An order was placed by a customer.',
  payload: zodSchema(
    z.object({
      orderId: z.string().describe('Identifier of the order.'),
      customer: z.object({
        id: z.string(),
        email: z.email().optional().describe('Absent for guests | anonymous buyers.'),
      }),
      total: money,
      lines: z.array(
        z.object({
          sku: z.string(),
          quantity: z.number().int().positive(),
          discount: money.nullable(),
          tags: z.array(z.object({ label: z.string() })).optional(),
        }),
      ),
      placedAt: z.iso.datetime(),
      channel: z.literal('web').optional(),
    }),
  ),
});

export const invoiceIssued = defineIntegrationEvent({
  type: 'billing.invoice.issued',
  version: 1,
  description: 'An invoice was issued for an order.',
  payload: zodSchema(z.object({ invoiceId: z.string(), orderId: z.string() })),
});

export const shipmentSent = defineIntegrationEvent({
  type: 'shipping.shipment.sent',
  version: 1,
  producer: 'logistics',
  payload: zodSchema(z.object({ shipmentId: z.string() })),
});

export const at = new Date('2026-03-01T10:00:00.000Z');
