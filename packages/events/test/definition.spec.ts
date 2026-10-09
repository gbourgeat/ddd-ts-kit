import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import {
  InvalidEventDefinitionError,
  InvalidEventPayloadError,
  defineIntegrationEvent,
  type PayloadOf,
} from '../src/index.js';
import { at, invoiceIssued, orderPlacedV1, shipmentSent } from './support/events.js';

const payload = zodSchema(z.object({ id: z.string() }));

describe('defineIntegrationEvent', () => {
  it('exposes the declaration and defaults the producer to the first segment of the type', () => {
    expect(orderPlacedV1).toMatchObject({
      type: 'ordering.order.placed',
      version: 1,
      producer: 'ordering',
      deprecated: true,
    });
    expect(invoiceIssued.deprecated).toBe(false);
    expect(shipmentSent.producer).toBe('logistics');
  });

  it.each([
    'ordering.order',
    'ordering.order.placed.twice',
    'Ordering.order.placed',
    'ordering.order_line.added',
    'ordering..placed',
    'ordering.order.-placed',
    '',
  ])('refuses the type "%s"', (type) => {
    expect(() => defineIntegrationEvent({ type, version: 1, payload })).toThrow(
      InvalidEventDefinitionError,
    );
  });

  it('accepts kebab-case segments', () => {
    const definition = defineIntegrationEvent({
      type: 'order-management.purchase-order.line-added',
      version: 3,
      payload,
    });
    expect(definition.producer).toBe('order-management');
  });

  it.each([0, -1, 1.5, Number.NaN])('refuses the version %s', (version) => {
    expect(() => defineIntegrationEvent({ type: 'a.b.c', version, payload })).toThrow(
      InvalidEventDefinitionError,
    );
  });

  it('refuses a producer that is not a context name', () => {
    expect(() =>
      defineIntegrationEvent({ type: 'a.b.c', version: 1, payload, producer: 'Billing Team' }),
    ).toThrow(InvalidEventDefinitionError);
  });
});

describe('create', () => {
  it('builds the envelope from a valid payload', () => {
    const event = invoiceIssued.create(
      { invoiceId: 'inv-1', orderId: 'order-1' },
      { id: 'evt-1', occurredAt: at },
    );
    expect(event).toEqual({
      id: 'evt-1',
      type: 'billing.invoice.issued',
      version: 1,
      occurredAt: '2026-03-01T10:00:00.000Z',
      payload: { invoiceId: 'inv-1', orderId: 'order-1' },
    });
  });

  it('carries the trace and correlation identifiers when given', () => {
    const event = invoiceIssued.create(
      { invoiceId: 'inv-1', orderId: 'order-1' },
      {
        id: 'evt-1',
        occurredAt: '2026-03-01T11:00:00+01:00',
        traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
        correlationId: 'corr-1',
      },
    );
    expect(event.occurredAt).toBe('2026-03-01T11:00:00+01:00');
    expect(event.traceparent).toBe('00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01');
    expect(event.correlationId).toBe('corr-1');
  });

  it('throws with the issues when the payload is invalid, without quoting the data', () => {
    const invalid: unknown = { invoiceId: 'inv-1', orderId: 42 };
    const create = (): unknown =>
      // The cast stands for a caller that escaped the type system: the schema is the last guard.
      invoiceIssued.create(invalid as PayloadOf<typeof invoiceIssued>, { id: 'e', occurredAt: at });
    expect(create).toThrow(InvalidEventPayloadError);
    try {
      create();
    } catch (error) {
      expect(error).toMatchObject({
        code: 'INVALID_EVENT_PAYLOAD',
        eventType: 'billing.invoice.issued',
        eventVersion: 1,
        issues: [{ path: 'orderId', code: 'invalid_type' }],
      });
      expect(String(error)).toContain('billing.invoice.issued v1 (orderId: invalid_type)');
    }
  });

  it('refuses an occurredAt that is not a date', () => {
    expect(() =>
      invoiceIssued.create({ invoiceId: 'i', orderId: 'o' }, { id: 'e', occurredAt: 'yesterday' }),
    ).toThrow(InvalidEventDefinitionError);
  });
});

describe('parse and is', () => {
  const event: IntegrationEvent = {
    id: 'evt-1',
    type: 'billing.invoice.issued',
    version: 1,
    occurredAt: at.toISOString(),
    payload: { invoiceId: 'inv-1', orderId: 'order-1' },
    correlationId: 'corr-1',
  };

  it('returns the typed event when type, version and payload match', () => {
    const parsed = invoiceIssued.parse(event);
    expect(parsed).toEqual({ ok: true, value: event });
    expect(invoiceIssued.is(event)).toBe(true);
  });

  it('reports another type', () => {
    expect(orderPlacedV1.parse(event)).toEqual({
      ok: false,
      error: {
        reason: 'type-mismatch',
        expected: 'ordering.order.placed',
        actual: 'billing.invoice.issued',
      },
    });
    expect(orderPlacedV1.is(event)).toBe(false);
  });

  it('reports another version', () => {
    const next = { ...event, version: 2 };
    expect(invoiceIssued.parse(next)).toEqual({
      ok: false,
      error: { reason: 'version-mismatch', expected: 1, actual: 2 },
    });
    expect(invoiceIssued.is(next)).toBe(false);
  });

  it('reports an invalid payload with its issues', () => {
    const parsed = invoiceIssued.parse({ ...event, payload: { invoiceId: 'inv-1' } });
    expect(parsed).toMatchObject({
      ok: false,
      error: { reason: 'invalid-payload', issues: [{ path: 'orderId' }] },
    });
  });
});
