import { describe, expect, it } from 'vitest';
import { customSchema } from '@ddd-ts-kit/validation';
import { ok } from '@ddd-ts-kit/kernel';
import { createEventRegistry, defineIntegrationEvent, generateEventCatalog, payloadFields } from '../src';
import { invoiceIssued, orderPlacedV1, orderPlacedV2, shipmentSent } from './support/events';

const definitions = [orderPlacedV2, shipmentSent, invoiceIssued, orderPlacedV1];

describe('generateEventCatalog', () => {
  const catalog = generateEventCatalog(createEventRegistry(definitions), {
    consumers: { 'ordering.order.placed': ['shipping', 'billing'] },
  });

  it('renders the whole catalog', () => {
    expect(catalog).toBe(`# Event catalog

Generated from the integration event declarations. Do not edit by hand: regenerate.

## billing

### billing.invoice.issued

| Type | Version | Description | Deprecated |
| --- | --- | --- | --- |
| \`billing.invoice.issued\` | 1 | An invoice was issued for an order. | no |

#### Payload of version 1

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| \`invoiceId\` | string | yes |  |
| \`orderId\` | string | yes |  |

## logistics

### shipping.shipment.sent

| Type | Version | Description | Deprecated |
| --- | --- | --- | --- |
| \`shipping.shipment.sent\` | 1 |  | no |

#### Payload of version 1

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| \`shipmentId\` | string | yes |  |

## ordering

### ordering.order.placed

| Type | Version | Description | Deprecated |
| --- | --- | --- | --- |
| \`ordering.order.placed\` | 1 | An order was placed. Superseded by version 2. | yes |
| \`ordering.order.placed\` | 2 | An order was placed by a customer. | no |

Consumers: \`billing\`, \`shipping\`

#### Payload of version 1

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| \`orderId\` | string | yes |  |
| \`total\` | number | yes |  |

#### Payload of version 2

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| \`orderId\` | string | yes | Identifier of the order. |
| \`customer\` | object | yes |  |
| \`customer.id\` | string | yes |  |
| \`customer.email\` | string (email) | no | Absent for guests \\| anonymous buyers. |
| \`total\` | object | yes |  |
| \`total.amount\` | integer | yes |  |
| \`total.currency\` | enum ("EUR", "USD") | yes |  |
| \`lines[]\` | array of object | yes |  |
| \`lines[].sku\` | string | yes |  |
| \`lines[].quantity\` | integer | yes |  |
| \`lines[].discount\` | object \\| null | yes |  |
| \`lines[].discount.amount\` | integer | yes |  |
| \`lines[].discount.currency\` | enum ("EUR", "USD") | yes |  |
| \`lines[].tags[]\` | array of object | no |  |
| \`placedAt\` | string (date-time) | yes |  |
| \`channel\` | const "web" | no |  |
`);
  });

  it('does not depend on the registration order or on the order of the consumers', () => {
    const other = generateEventCatalog(createEventRegistry([...definitions].reverse()), {
      consumers: { 'ordering.order.placed': ['billing', 'shipping'] },
    });

    expect(other).toBe(catalog);
  });
});

describe('generateEventCatalog, on what a registry may lack', () => {
  it('takes a title and renders an empty registry', () => {
    expect(generateEventCatalog(createEventRegistry(), { title: 'Shop events' })).toBe(
      '# Shop events\n\nGenerated from the integration event declarations. Do not edit by hand: regenerate.\n',
    );
  });

  it('says so when the schema documents no field', () => {
    const opaque = defineIntegrationEvent({
      type: 'audit.entry.recorded',
      version: 1,
      payload: customSchema((input) => ok(input)),
    });

    expect(generateEventCatalog(createEventRegistry([opaque]))).toContain(
      '#### Payload of version 1\n\nNo documented field.\n',
    );
  });
});

describe('payloadFields', () => {
  it('reads as any a property the schema types with nothing, or with no schema at all', () => {
    const fields = payloadFields({
      type: 'object',
      properties: { anything: true, untyped: { description: 'Whatever the producer put there.' } },
    });

    expect(fields).toEqual([
      { path: 'anything', type: 'any', required: false, description: '' },
      { path: 'untyped', type: 'any', required: false, description: 'Whatever the producer put there.' },
    ]);
  });

  it('stops on a recursive schema instead of looping', () => {
    const fields = payloadFields({
      type: 'object',
      required: ['root'],
      properties: { root: { $ref: '#/$defs/Node' } },
      $defs: {
        Node: {
          type: 'object',
          properties: {
            label: { type: ['string', 'null'] },
            children: { type: 'array', items: { $ref: '#/$defs/Node' } },
          },
        },
      },
    });

    expect(fields).toEqual([
      { path: 'root', type: 'object', required: true, description: '' },
      { path: 'root.label', type: 'string | null', required: false, description: '' },
      { path: 'root.children[]', type: 'array of Node', required: false, description: '' },
    ]);
  });
});
