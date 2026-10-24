import { describe, expect, it } from 'vitest';
import { InvalidDataSubjectErasedError, dataSubjectErasedV1 } from '../src';

const meta = { id: 'event-1', occurredAt: '2026-03-01T10:00:00.000Z' };

describe('dataSubjectErasedV1', () => {
  const payload = { subjectId: 'cus_42', erasedAt: '2026-03-01T10:00:00.000Z' };

  it('is published by the privacy capability of the platform, under a type of its own', () => {
    expect(dataSubjectErasedV1).toMatchObject({ type: 'privacy.data-subject.erased', version: 1, producer: 'privacy' });

    expect(dataSubjectErasedV1.create(payload, { ...meta, occurredAt: new Date(meta.occurredAt) })).toEqual({
      ...meta,
      type: 'privacy.data-subject.erased',
      version: 1,
      payload,
    });
  });

  it('carries the trace and the correlation it is given', () => {
    const event = dataSubjectErasedV1.create(payload, { ...meta, traceparent: 'trace-1', correlationId: 'erasure-1' });

    expect(event).toMatchObject({ traceparent: 'trace-1', correlationId: 'erasure-1' });
    expect(dataSubjectErasedV1.is(event)).toBe(true);
    expect(dataSubjectErasedV1.parse(event)).toEqual({ ok: true, value: event });
  });

  it('refuses an event of another type or another version', () => {
    const event = dataSubjectErasedV1.create(payload, meta);

    expect(dataSubjectErasedV1.parse({ ...event, type: 'crm.customer.erased' })).toMatchObject({
      ok: false,
      error: { reason: 'type-mismatch' },
    });

    expect(dataSubjectErasedV1.parse({ ...event, version: 2 })).toMatchObject({
      ok: false,
      error: { reason: 'version-mismatch', expected: 1, actual: 2 },
    });

    expect(dataSubjectErasedV1.is({ ...event, version: 2 })).toBe(false);
  });

  it('documents its three fields for the catalog and AsyncAPI', () => {
    expect(dataSubjectErasedV1.payload.toJsonSchema()).toMatchObject({
      required: ['subjectId', 'erasedAt'],
      additionalProperties: false,
    });
  });

  it('refuses to publish a subject that is not an opaque identifier: a name or an email never travels', () => {
    expect(() => dataSubjectErasedV1.create({ ...payload, subjectId: 'ada@example.org' }, meta)).toThrow(
      InvalidDataSubjectErasedError,
    );
  });

  it('reports every field a consumer received wrong, never throwing', () => {
    const parsed = dataSubjectErasedV1.parse({
      ...meta,
      type: 'privacy.data-subject.erased',
      version: 1,
      payload: { subjectId: 'Ada Lovelace', erasedAt: 'yesterday', requestedBy: 'Ada Admin' },
    });

    expect(parsed.ok).toBe(false);

    expect(parsed.ok ? [] : parsed.error).toMatchObject({
      reason: 'invalid-payload',
      issues: [{ path: 'subjectId' }, { path: 'erasedAt' }],
    });
  });

  it('carries no operator: who asked stays in the audit trail, which the correlation id leads to', () => {
    const event = dataSubjectErasedV1.create(payload, { ...meta, correlationId: 'erasure-1' });

    expect(Object.keys(event.payload)).toEqual(['subjectId', 'erasedAt']);
    expect(event.correlationId).toBe('erasure-1');
    expect(dataSubjectErasedV1.payload.toJsonSchema()).not.toHaveProperty('properties.requestedBy');
  });

  it('refuses a payload that is not an object', () => {
    const parsed = dataSubjectErasedV1.parse({ ...meta, type: 'privacy.data-subject.erased', version: 1, payload: 42 });

    expect(parsed.ok).toBe(false);
  });
});
