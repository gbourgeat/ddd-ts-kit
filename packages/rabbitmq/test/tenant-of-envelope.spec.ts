import { describe, expect, it } from 'vitest';
import type { Message, MessageProperties } from 'amqplib';
import { decode } from '../src/codec/decode';

const envelope = { id: 'evt-1', type: 'billing.invoice-issued', version: 1, occurredAt: '2026-03-01T10:00:00.000Z' };

const properties: MessageProperties = {
  contentType: 'application/json',
  contentEncoding: undefined,
  headers: {},
  deliveryMode: undefined,
  priority: undefined,
  correlationId: undefined,
  replyTo: undefined,
  expiration: undefined,
  messageId: undefined,
  timestamp: undefined,
  type: undefined,
  userId: undefined,
  appId: undefined,
  clusterId: undefined,
};

const decoded = (body: object) => {
  const message: Message = {
    content: Buffer.from(JSON.stringify(body)),
    fields: { deliveryTag: 1, redelivered: false, exchange: 'events', routingKey: 'billing.invoice-issued' },
    properties,
  };

  return decode(message);
};

describe('the tenant of a consumed envelope', () => {
  it('is kept when it is a tenant id', () => {
    expect(decoded({ ...envelope, tenantId: 'acme' })?.tenantId).toBe('acme');
    expect(decoded(envelope)?.tenantId).toBeUndefined();
  });

  it('makes the envelope poison when it could widen what the consumer reaches', () => {
    for (const tenantId of ['*', 'acme,globex', 'acme:products', '', 7]) {
      expect(decoded({ ...envelope, tenantId })).toBeUndefined();
    }
  });
});
