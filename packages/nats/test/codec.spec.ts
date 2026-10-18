import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import { headers, type MsgHdrs } from '@nats-io/transport-node';
import { describe, expect, it } from 'vitest';
import { decode } from '../src/codec/decode.js';
import { encode } from '../src/codec/encode.js';
import { republication } from '../src/codec/republication.js';
import { anEvent, PLACED, TRACEPARENT } from './support/events.js';

const traced: IntegrationEvent = {
  ...anEvent('evt-1'),
  traceparent: TRACEPARENT,
  correlationId: 'corr-1',
  tenantId: 'acme',
};

const envelope = { id: 'evt-1', type: PLACED, version: 1, occurredAt: '2026-03-01T10:00:00.000Z' };

const decodedText = (text: string) => decode(new TextEncoder().encode(text));

const bytesOf = (data: string | Uint8Array) => (typeof data === 'string' ? new TextEncoder().encode(data) : data);

const recordOf = (given: MsgHdrs | undefined) => Object.fromEntries([...(given ?? [])]);

const headersFrom = (record: Record<string, readonly string[]>): MsgHdrs => {
  const built = headers();

  for (const [name, values] of Object.entries(record)) {
    for (const value of values) {
      built.append(name, value);
    }
  }

  return built;
};

describe('the codec of an envelope', () => {
  it('decodes what it encoded into the same event', () => {
    for (const event of [anEvent('evt-1'), traced]) {
      expect(decode(bytesOf(encode(event).data))).toEqual(event);
    }
  });

  it('publishes an event under its id, for the stream to drop a second copy', () => {
    expect(encode(anEvent('evt-1')).messageId).toBe('evt-1');
  });

  it('repeats the type and the version in the headers', () => {
    expect(recordOf(encode(anEvent('evt-1')).headers)).toEqual({
      'x-event-type': [PLACED],
      'x-event-version': ['1'],
    });
  });

  it('adds the trace, the correlation and the tenant headers only when the event carries them', () => {
    expect(recordOf(encode(traced).headers)).toEqual({
      'x-event-type': [PLACED],
      'x-event-version': ['1'],
      traceparent: [TRACEPARENT],
      'x-correlation-id': ['corr-1'],
      'x-tenant-id': ['acme'],
    });
  });

  it('decodes no event from a body that is not an envelope', () => {
    expect(decode(new Uint8Array())).toBeUndefined();
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

describe('a republished message', () => {
  const data = new TextEncoder().encode(JSON.stringify(envelope));

  it('keeps the body and its headers, with the headers added or replaced', () => {
    const message = {
      data,
      headers: headersFrom({ 'x-event-type': [PLACED], 'x-attempt': ['1'], 'x-tag': ['a', 'b'] }),
      messageId: 'evt-1.dead.1',
    };

    const copy = republication(message, { 'x-attempt': '2', 'x-dead-reason': 'HANDLER_FAILED' });

    expect(copy.data).toBe(data);
    expect(copy.messageId).toBe('evt-1.dead.1');

    expect(recordOf(copy.headers)).toEqual({
      'x-event-type': [PLACED],
      'x-attempt': ['2'],
      'x-tag': ['a', 'b'],
      'x-dead-reason': ['HANDLER_FAILED'],
    });
  });

  it('drops the id the stream deduplicated the original on, so the copy is not taken for a duplicate', () => {
    const message = { data, headers: headersFrom({ 'Nats-Msg-Id': ['evt-1'] }), messageId: 'evt-1.replay.1' };

    expect(recordOf(republication(message, { 'x-replay-for': 'billing' }).headers)).toEqual({
      'x-replay-for': ['billing'],
    });
  });

  it('carries only the added headers when the original had none', () => {
    const message = { data, headers: undefined, messageId: 'evt-1.dead.1' };

    expect(recordOf(republication(message, { 'x-source': 'integration-events/41' }).headers)).toEqual({
      'x-source': ['integration-events/41'],
    });
  });
});
