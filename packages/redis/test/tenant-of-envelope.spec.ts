import { describe, expect, it } from 'vitest';
import { decode } from '../src/streams/codec/decode';
import { ENVELOPE_FIELD } from '../src/streams/codec/entry-fields';

const envelope = { id: 'evt-1', type: 'billing.invoice-issued', version: 1, occurredAt: '2026-03-01T10:00:00.000Z' };

const decoded = (body: object) => decode({ id: '1-0', fields: new Map([[ENVELOPE_FIELD, JSON.stringify(body)]]) });

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
