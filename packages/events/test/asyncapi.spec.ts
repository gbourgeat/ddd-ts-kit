import { describe, expect, it } from 'vitest';
import { createEventRegistry } from '../src';
import { checkAsyncApiDrift, generateAsyncApi, stringifyAsyncApi } from '../src/asyncapi';
import { invoiceIssued, orderPlacedV1, orderPlacedV2, shipmentSent } from './support/events';

const info = { title: 'Shop events', version: '1.4.0', description: 'Published language.' };
const definitions = [orderPlacedV2, shipmentSent, invoiceIssued, orderPlacedV1];

const document = generateAsyncApi({
  info,
  registry: createEventRegistry(definitions),
  servers: {
    production: { host: 'broker.example.com:5671', protocol: 'amqps' },
    development: { host: 'localhost:5672', protocol: 'amqp', description: 'Local broker.' },
  },
});

describe('generateAsyncApi', () => {
  it('produces an AsyncAPI 3.0.0 document with its header and sorted servers', () => {
    expect(document.asyncapi).toBe('3.0.0');
    expect(document.info).toEqual(info);
    expect(Object.keys(document.servers ?? {})).toEqual(['development', 'production']);
  });

  it('declares one channel per event type, addressed by the type', () => {
    expect(Object.keys(document.channels)).toEqual([
      'billing.invoice.issued',
      'ordering.order.placed',
      'shipping.shipment.sent',
    ]);

    expect(document.channels['ordering.order.placed']).toEqual({
      address: 'ordering.order.placed',
      description: 'An order was placed by a customer.',
      messages: {
        v1: { $ref: '#/components/messages/ordering.order.placed.v1' },
        v2: { $ref: '#/components/messages/ordering.order.placed.v2' },
      },
    });

    expect(document.channels['shipping.shipment.sent']).not.toHaveProperty('description');
  });

  it('declares one send operation per channel covering every version', () => {
    expect(document.operations).toMatchObject({
      'send.ordering.order.placed': {
        action: 'send',
        channel: { $ref: '#/channels/ordering.order.placed' },
        messages: [
          { $ref: '#/channels/ordering.order.placed/messages/v1' },
          { $ref: '#/channels/ordering.order.placed/messages/v2' },
        ],
      },
    });

    expect(Object.keys(document.operations)).toHaveLength(3);
  });

  it('describes each version as a message whose payload is the envelope', () => {
    expect(document.components.messages['billing.invoice.issued.v1']).toEqual({
      name: 'billing.invoice.issued',
      title: 'billing.invoice.issued v1',
      summary: 'An invoice was issued for an order.',
      contentType: 'application/json',
      tags: [{ name: 'billing' }],
      payload: {
        type: 'object',
        required: ['id', 'type', 'version', 'occurredAt', 'payload'],
        properties: {
          id: { type: 'string', description: 'Unique id of the event: the idempotency key.' },
          type: { type: 'string', const: 'billing.invoice.issued' },
          version: { type: 'integer', const: 1 },
          occurredAt: { type: 'string', format: 'date-time' },
          payload: {
            type: 'object',
            properties: { invoiceId: { type: 'string' }, orderId: { type: 'string' } },
            required: ['invoiceId', 'orderId'],
          },
          traceparent: { type: 'string', description: 'W3C traceparent captured at publication.' },
          correlationId: { type: 'string' },
        },
      },
    });
  });

  it('flags deprecated versions and tags the declared producer', () => {
    const { messages } = document.components;

    expect(messages['ordering.order.placed.v1']).toMatchObject({ deprecated: true });
    expect(messages['ordering.order.placed.v2']).not.toHaveProperty('deprecated');
    expect(messages['shipping.shipment.sent.v1']).toMatchObject({ tags: [{ name: 'logistics' }] });
  });

  it('moves local definitions of a payload to the components and repoints the references', () => {
    expect(document.components.schemas).toEqual({
      'ordering.order.placed.v2.Money': expect.objectContaining({ type: 'object' }),
    });

    const text = JSON.stringify(document);

    expect(text).toContain('"$ref":"#/components/schemas/ordering.order.placed.v2.Money"');
    expect(text).not.toContain('$defs');
    expect(text).not.toContain('$schema');
  });
});

describe('generateAsyncApi, optional parts and determinism', () => {
  it('omits what was not given', () => {
    const minimal = generateAsyncApi({
      info: { title: 'T', version: '1' },
      registry: createEventRegistry([invoiceIssued]),
    });

    expect(minimal).not.toHaveProperty('servers');
    expect(minimal.info).toEqual({ title: 'T', version: '1' });
    expect(minimal.components).not.toHaveProperty('schemas');
  });

  it('does not depend on the registration order', () => {
    const reversed = generateAsyncApi({
      info,
      registry: createEventRegistry([...definitions].reverse()),
      servers: {
        development: { host: 'localhost:5672', protocol: 'amqp', description: 'Local broker.' },
        production: { host: 'broker.example.com:5671', protocol: 'amqps' },
      },
    });

    expect(stringifyAsyncApi(reversed)).toBe(stringifyAsyncApi(document));
  });
});

describe('stringifyAsyncApi and checkAsyncApiDrift', () => {
  const text = stringifyAsyncApi(document);

  it('prints two-space JSON with a trailing newline', () => {
    expect(text.startsWith('{\n  "asyncapi": "3.0.0",\n')).toBe(true);
    expect(text.endsWith('}\n')).toBe(true);
    expect(JSON.parse(text)).toEqual(document);
  });

  it('sees no drift on the committed content, whatever its line endings', () => {
    expect(checkAsyncApiDrift(document, text)).toEqual({ drift: false });
    expect(checkAsyncApiDrift(document, text.replaceAll('\n', '\r\n'))).toEqual({ drift: false });
  });

  it('sees the drift when a declaration changed', () => {
    const before = generateAsyncApi({ info, registry: createEventRegistry([orderPlacedV1]) });

    expect(checkAsyncApiDrift(before, text)).toEqual({ drift: true });
  });
});
