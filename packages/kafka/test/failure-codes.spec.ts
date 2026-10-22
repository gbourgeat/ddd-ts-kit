import { describe, expect, it } from 'vitest';
import { BrokerUnavailableError } from '../src/errors/broker-unavailable-error';
import { failureCode } from '../src/errors/failure-code';
import { PublishNotAcknowledgedError } from '../src/errors/publish-not-acknowledged-error';
import { reasonOf } from '../src/errors/reason-of';
import { conceal } from '../src/secrecy/conceal';

class InvoiceRejected extends Error {}

describe('the code of a failure', () => {
  it('is the name librdkafka gives the error', () => {
    expect(failureCode({ type: 'ERR__MSG_TIMED_OUT', message: 'secret host:9092' })).toBe('ERR__MSG_TIMED_OUT');
    expect(failureCode({ type: 'ERR_UNKNOWN_TOPIC_OR_PART' })).toBe('ERR_UNKNOWN_TOPIC_OR_PART');
  });

  it('falls back to the code or the class of the error when the type is not a librdkafka name', () => {
    expect(failureCode({ type: 'timeout', code: 'ECONNREFUSED' })).toBe('ECONNREFUSED');
    expect(failureCode({ type: 7, code: 'ECONNREFUSED' })).toBe('ECONNREFUSED');
    expect(failureCode(new InvoiceRejected('the amount is negative'))).toBe('InvoiceRejected');
    expect(failureCode('a thrown text')).toBe('UNKNOWN_ERROR');
    expect(failureCode(null)).toBe('UNKNOWN_ERROR');
  });

  it('is the reason the bus already named, or the code of what the client raised', () => {
    expect(reasonOf(new BrokerUnavailableError('ERR__TRANSPORT'))).toBe('ERR__TRANSPORT');
    expect(reasonOf(new PublishNotAcknowledgedError(['evt-1'], 'ERR__MSG_TIMED_OUT'))).toBe('ERR__MSG_TIMED_OUT');
    expect(reasonOf({ type: 'ERR__ALL_BROKERS_DOWN' })).toBe('ERR__ALL_BROKERS_DOWN');
  });

  it('names the error without the message of the client', () => {
    const unavailable = new BrokerUnavailableError('ERR__TRANSPORT');
    const unacknowledged = new PublishNotAcknowledgedError(['evt-1', 'evt-2'], 'ERR__MSG_TIMED_OUT');

    expect(unavailable).toMatchObject({ code: 'BROKER_UNAVAILABLE', name: 'BrokerUnavailableError' });
    expect(unavailable.message).toBe('The broker is unavailable (ERR__TRANSPORT)');

    expect(unacknowledged).toMatchObject({
      code: 'PUBLISH_NOT_ACKNOWLEDGED',
      name: 'PublishNotAcknowledgedError',
      eventIds: ['evt-1', 'evt-2'],
    });

    expect(unacknowledged.message).toBe('The broker did not acknowledge 2 event(s) (ERR__MSG_TIMED_OUT)');
  });
});

describe('a concealed instance', () => {
  it('keeps its fields out of enumeration, a spread and a serialization, but still reaches them', () => {
    const connection = { brokers: 'user:secret@host:9092', client: { 'sasl.password': 'secret' } };

    conceal(connection);

    expect(Object.keys(connection)).toEqual([]);
    expect({ ...connection }).toEqual({});
    expect(JSON.stringify(connection)).toBe('{}');
    expect(connection.brokers).toBe('user:secret@host:9092');
  });

  it('keeps enumerable the fields added after it was concealed', () => {
    const instance: Record<string, string> = { secret: 'secret' };

    conceal(instance);
    instance['name'] = 'KafkaEventBus';

    expect(Object.keys(instance)).toEqual(['name']);
  });
});
