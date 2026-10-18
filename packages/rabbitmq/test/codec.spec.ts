import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import type { Message, MessageProperties } from 'amqplib';
import { describe, expect, it } from 'vitest';
import { attemptOf } from '../src/codec/attempt-of.js';
import { decode } from '../src/codec/decode.js';
import { encode } from '../src/codec/encode.js';
import { headersOf } from '../src/codec/headers-of.js';
import { republication } from '../src/codec/republication.js';
import { anEvent, PLACED, TRACEPARENT } from './support/events.js';

const traced: IntegrationEvent = {
  ...anEvent('evt-1'),
  traceparent: TRACEPARENT,
  correlationId: 'corr-1',
  tenantId: 'acme',
};

const envelope = { id: 'evt-1', type: PLACED, version: 1, occurredAt: '2026-03-01T10:00:00.000Z' };

const noProperties: MessageProperties = {
  contentType: undefined,
  contentEncoding: undefined,
  headers: undefined,
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

const received = (content: Buffer, properties: Partial<MessageProperties> = {}): Message => ({
  content,
  fields: { deliveryTag: 1, redelivered: false, exchange: 'integration-events', routingKey: PLACED },
  properties: { ...noProperties, ...properties },
});

const decodedText = (text: string) => decode(received(Buffer.from(text)));

describe('the codec of an envelope', () => {
  it('decodes what it encoded into the same event', () => {
    for (const event of [anEvent('evt-1'), traced]) {
      expect(decode(received(encode(event).content))).toEqual(event);
    }
  });

  it('publishes a persistent JSON message under the id and the type of the event', () => {
    expect(encode(anEvent('evt-1')).properties).toEqual({
      persistent: true,
      contentType: 'application/json',
      messageId: 'evt-1',
      type: PLACED,
      headers: { 'x-event-version': 1 },
    });
  });

  it('adds the correlation, the trace and the tenant only when the event carries them', () => {
    expect(encode(traced).properties).toEqual({
      persistent: true,
      contentType: 'application/json',
      messageId: 'evt-1',
      type: PLACED,
      correlationId: 'corr-1',
      headers: {
        'x-event-version': 1,
        traceparent: TRACEPARENT,
        'x-correlation-id': 'corr-1',
        'x-tenant-id': 'acme',
      },
    });
  });

  it('decodes no event from a body that is not an envelope', () => {
    expect(decode(received(Buffer.alloc(0)))).toBeUndefined();
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

describe('a received message', () => {
  const content = Buffer.from(JSON.stringify(envelope));

  it('answers its headers as a record of its own, empty when it carries none', () => {
    const headers = { 'x-attempt': 2 };
    const answered = headersOf(received(content, { headers }));

    expect(answered).toEqual(headers);
    expect(answered).not.toBe(headers);
    expect(headersOf(received(content))).toEqual({});
  });

  it('is at the delivery its attempt header says, the first one otherwise', () => {
    expect(attemptOf(received(content, { headers: { 'x-attempt': 3 } }))).toBe(3);
    expect(attemptOf(received(content))).toBe(1);

    for (const attempt of [0, -2, 1.5, '2', null]) {
      expect(attemptOf(received(content, { headers: { 'x-attempt': attempt } }))).toBe(1);
    }
  });

  it('is republished with its body and its text properties, and headers added or replaced', () => {
    const message = received(content, {
      messageId: 'evt-1',
      type: PLACED,
      correlationId: 'corr-1',
      headers: { 'x-event-version': 1, 'x-attempt': 1 },
    });

    expect(republication(message, { 'x-attempt': 2, 'x-dead-reason': 'HANDLER_FAILED' })).toEqual({
      content,
      properties: {
        persistent: true,
        contentType: 'application/json',
        messageId: 'evt-1',
        type: PLACED,
        correlationId: 'corr-1',
        headers: { 'x-event-version': 1, 'x-attempt': 2, 'x-dead-reason': 'HANDLER_FAILED' },
      },
    });
  });

  it('is republished without the properties it did not carry as text', () => {
    const message = received(Buffer.from('not json'), { messageId: 7, type: undefined });

    expect(republication(message, { 'x-dead-reason': 'POISON_MESSAGE' }).properties).toEqual({
      persistent: true,
      contentType: 'application/json',
      headers: { 'x-dead-reason': 'POISON_MESSAGE' },
    });
  });
});
