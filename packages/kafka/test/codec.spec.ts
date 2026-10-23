import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import { describe, expect, it } from 'vitest';
import { decode } from '../src/codec/decode';
import { encode } from '../src/codec/encode';
import type { IncomingRecord } from '../src/codec/incoming-record';
import { republication } from '../src/codec/republication';
import type { Routing } from '../src/codec/routing';
import { sourceOf } from '../src/codec/source-of';
import { textHeader } from '../src/codec/text-header';
import { anEvent, PLACED, TRACEPARENT } from './support/events';

const byType: Routing = { topicOf: (type) => `topic.${type}`, keyOf: (event) => event.id };

const traced: IntegrationEvent = {
  ...anEvent('evt-1'),
  traceparent: TRACEPARENT,
  correlationId: 'corr-1',
  tenantId: 'acme',
};

const envelope = { id: 'evt-1', type: PLACED, version: 1, occurredAt: '2026-03-01T10:00:00.000Z' };

const decodedText = (text: string) => decode(Buffer.from(text));

const received = (headers: IncomingRecord['message']['headers'] = {}): IncomingRecord => ({
  topic: PLACED,
  partition: 2,
  message: {
    key: Buffer.from('order-1'),
    value: Buffer.from('{}'),
    timestamp: '0',
    attributes: 0,
    offset: '41',
    headers,
    deserializedKey: { key: null, error: null },
    deserializedValue: { value: null, error: null },
  },
});

describe('the codec of an envelope', () => {
  it('decodes what it encoded into the same event', () => {
    for (const event of [anEvent('evt-1'), traced]) {
      const { message } = encode(event, byType);

      expect(decode(Buffer.from(String(message.value)))).toEqual(event);
    }
  });

  it('sends an event to the topic and under the key the routing gives', () => {
    const record = encode(anEvent('evt-1'), byType);

    expect(record.topic).toBe(`topic.${PLACED}`);
    expect(record.message.key).toBe('evt-1');
  });

  it('sends an event without a key when the routing gives none', () => {
    const record = encode(anEvent('evt-1'), { ...byType, keyOf: () => undefined });

    expect(record.message.key).toBeNull();
  });

  it('repeats the id, the type and the version in the headers', () => {
    expect(encode(anEvent('evt-1'), byType).message.headers).toEqual({
      'x-event-id': 'evt-1',
      'x-event-type': PLACED,
      'x-event-version': '1',
    });
  });

  it('adds the trace, the correlation and the tenant headers only when the event carries them', () => {
    expect(encode(traced, byType).message.headers).toEqual({
      'x-event-id': 'evt-1',
      'x-event-type': PLACED,
      'x-event-version': '1',
      traceparent: TRACEPARENT,
      'x-correlation-id': 'corr-1',
      'x-tenant-id': 'acme',
    });
  });

  it('decodes no event from a value that is not an envelope', () => {
    expect(decode(null)).toBeUndefined();
    expect(decodedText('not json')).toBeUndefined();
    expect(decodedText('"a text"')).toBeUndefined();
    expect(decodedText('null')).toBeUndefined();

    for (const field of ['id', 'type', 'occurredAt'] as const) {
      expect(decodedText(JSON.stringify({ ...envelope, [field]: undefined }))).toBeUndefined();
      expect(decodedText(JSON.stringify({ ...envelope, [field]: '' }))).toBeUndefined();
    }

    expect(decodedText(JSON.stringify({ ...envelope, version: '1' }))).toBeUndefined();
    expect(decodedText(JSON.stringify({ ...envelope, version: undefined }))).toBeUndefined();
  });

  it('keeps the trace and the correlation of an envelope only when they are text', () => {
    const event = decodedText(JSON.stringify({ ...envelope, traceparent: 7, correlationId: { id: 'corr-1' } }));

    expect(event).toEqual({ ...envelope, payload: undefined });
  });
});

describe('a received record', () => {
  it('answers the first value of a header as text', () => {
    const record = received({ 'x-attempt': [Buffer.from('2'), '3'], 'x-event-id': 'evt-1' });

    expect(textHeader(record, 'x-attempt')).toBe('2');
    expect(textHeader(record, 'x-event-id')).toBe('evt-1');
    expect(textHeader(record, 'x-tenant-id')).toBeUndefined();
  });

  it('says where it sits in the log', () => {
    expect(sourceOf(received())).toBe(`${PLACED}/2/41`);
  });

  it('is republished on another topic with its key and value, and headers added or replaced', () => {
    const record = received({ 'x-event-id': 'evt-1', 'x-attempt': '1' });

    expect(republication(record, 'billing.dead', { 'x-attempt': '2', 'x-dead-reason': 'HANDLER_FAILED' })).toEqual({
      topic: 'billing.dead',
      message: {
        key: record.message.key,
        value: record.message.value,
        headers: { 'x-event-id': 'evt-1', 'x-attempt': '2', 'x-dead-reason': 'HANDLER_FAILED' },
      },
    });
  });
});
