import type { EventDelivery, IntegrationEventCallback } from '@ddd-ts-kit/kernel';
import { describe, expect, it } from 'vitest';
import { failureOf } from '../src/consumption/failure-of.js';
import { track } from '../src/consumption/track.js';
import { BrokerUnavailableError } from '../src/errors/broker-unavailable-error.js';
import { ConsumerNameRequiredError } from '../src/errors/consumer-name-required-error.js';
import { EventBusClosedError } from '../src/errors/event-bus-closed-error.js';
import { failureCode } from '../src/errors/failure-code.js';
import { PublishNotConfirmedError } from '../src/errors/publish-not-confirmed-error.js';
import { UnroutableEventError } from '../src/errors/unroutable-event-error.js';
import { conceal } from '../src/secrecy/conceal.js';
import { anEvent, PLACED } from './support/events.js';

class InvoiceRejected extends Error {}

const delivery: EventDelivery = { attempt: 2, maxAttempts: 5, system: 'rabbitmq' };

describe('the code of a failure', () => {
  it('names the AMQP reply code amqplib carries as a number', () => {
    expect(failureCode({ code: 406, message: 'PRECONDITION_FAILED - inequivalent arg' })).toBe('AMQP_406');
    expect(failureCode(Object.assign(new Error('NOT_FOUND - no queue'), { code: 404 }))).toBe('AMQP_404');
  });

  it('falls back to the code or the class of the error when the code is not an AMQP reply code', () => {
    expect(failureCode(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }))).toBe(
      'ECONNREFUSED',
    );

    expect(failureCode({ code: 1.5 })).toBe('UNKNOWN_ERROR');
    expect(failureCode(new InvoiceRejected('the amount is negative'))).toBe('InvoiceRejected');
    expect(failureCode('a thrown text')).toBe('UNKNOWN_ERROR');
    expect(failureCode(null)).toBe('UNKNOWN_ERROR');
  });
});

describe('the errors of the bus', () => {
  it('name what went wrong without the message of the client', () => {
    const unavailable = new BrokerUnavailableError('ECONNREFUSED');
    const unconfirmed = new PublishNotConfirmedError('evt-1');
    const unroutable = new UnroutableEventError('evt-1', PLACED);

    expect(unavailable).toMatchObject({ code: 'BROKER_UNAVAILABLE', name: 'BrokerUnavailableError' });
    expect(unavailable.message).toBe('The broker is unavailable (ECONNREFUSED)');

    expect(unconfirmed).toMatchObject({
      code: 'PUBLISH_NOT_CONFIRMED',
      name: 'PublishNotConfirmedError',
      eventId: 'evt-1',
    });

    expect(unconfirmed.message).toBe('The broker did not confirm event evt-1');

    expect(unroutable).toMatchObject({
      code: 'UNROUTABLE_EVENT',
      name: 'UnroutableEventError',
      eventId: 'evt-1',
      eventType: PLACED,
    });

    expect(unroutable.message).toBe(`No queue is bound for ${PLACED}: event evt-1 was returned by the broker`);
  });

  it('say how to subscribe without a consumer, and that a closed bus is closed', () => {
    expect(new ConsumerNameRequiredError()).toMatchObject({
      code: 'CONSUMER_NAME_REQUIRED',
      name: 'ConsumerNameRequiredError',
    });

    expect(new ConsumerNameRequiredError().message).toContain('forConsumer(name)');
    expect(new EventBusClosedError()).toMatchObject({ code: 'EVENT_BUS_CLOSED', name: 'EventBusClosedError' });
  });
});

describe('the failure of a delivery', () => {
  it('is none when every handler resolves, each told which delivery this is', async () => {
    const seen: (EventDelivery | undefined)[] = [];

    const handler: IntegrationEventCallback = async (_event, given) => {
      seen.push(given);
    };

    expect(await failureOf(new Set([handler]), anEvent('evt-1'), delivery)).toBeUndefined();
    expect(seen).toEqual([delivery]);
  });

  it('runs every handler and gives the code of the first that fails', async () => {
    const ran: string[] = [];

    const handlers = new Set<IntegrationEventCallback>([
      async () => {
        ran.push('first');
        throw new InvoiceRejected('the amount is negative');
      },
      async () => {
        ran.push('second');
        throw new BrokerUnavailableError('ECONNREFUSED');
      },
      async () => {
        ran.push('third');
      },
    ]);

    expect(await failureOf(handlers, anEvent('evt-1'), delivery)).toBe('InvoiceRejected');
    expect(ran).toEqual(['first', 'second', 'third']);
  });
});

describe('the work a bus waits for', () => {
  it('is kept while it is pending, whether it resolves or rejects', async () => {
    const pending = new Set<Promise<void>>();
    const handled = Promise.resolve();
    const failed = Promise.reject(new Error('the handler failed'));

    track(pending, handled);
    track(pending, failed);

    expect([...pending]).toEqual([handled, failed]);
    await Promise.allSettled([handled, failed]);
    expect([...pending]).toEqual([]);
  });
});

describe('a concealed instance', () => {
  it('keeps its fields out of enumeration, a spread and a serialization, but still reaches them', () => {
    const connection = { url: 'amqp://kit:secret@host:5672', options: { password: 'secret' } };

    conceal(connection);

    expect(Object.keys(connection)).toEqual([]);
    expect({ ...connection }).toEqual({});
    expect(JSON.stringify(connection)).toBe('{}');
    expect(connection.url).toBe('amqp://kit:secret@host:5672');
  });

  it('keeps enumerable the fields added after it was concealed', () => {
    const instance: Record<string, string> = { secret: 'secret' };

    conceal(instance);
    instance['name'] = 'RabbitMqEventBus';

    expect(Object.keys(instance)).toEqual(['name']);
  });
});
