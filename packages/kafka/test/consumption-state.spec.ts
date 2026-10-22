import type { EventDelivery, IntegrationEventCallback } from '@ddd-ts-kit/kernel';
import { describe, expect, it } from 'vitest';
import type { IncomingRecord } from '../src/codec/incoming-record';
import { Attempts } from '../src/consumption/attempts';
import { Backoff } from '../src/consumption/backoff';
import { failureOf } from '../src/consumption/failure-of';
import { BrokerUnavailableError } from '../src/errors/broker-unavailable-error';
import { within } from '../src/errors/within';
import { anEvent, PLACED } from './support/events';

const recordAt = (offset: string, partition = 0): IncomingRecord => ({
  topic: PLACED,
  partition,
  message: {
    key: null,
    value: null,
    timestamp: '0',
    attributes: 0,
    offset,
    headers: {},
    deserializedKey: { key: null, error: null },
    deserializedValue: { value: null, error: null },
  },
});

const delivery: EventDelivery = { attempt: 2, maxAttempts: 5, system: 'kafka' };

describe('the backoff of a reconnection', () => {
  it('waits longer after each failure, up to its maximum, and starts again once reset', () => {
    const backoff = new Backoff({ initialMs: 200, factor: 2, maxMs: 1_000 });
    const delays: number[] = [];

    for (let failure = 0; failure < 5; failure += 1) {
      delays.push(backoff.delayMs);
      backoff.failed();
    }

    backoff.reset();

    expect(delays).toEqual([200, 400, 800, 1_000, 1_000]);
    expect(backoff.delayMs).toBe(200);
  });
});

describe('the attempts of a record', () => {
  it('count the failures of the record at the head of a partition', () => {
    const attempts = new Attempts();
    const head = recordAt('7');

    expect(attempts.of(head)).toBe(1);

    attempts.failed(head);
    attempts.failed(head);

    expect(attempts.of(head)).toBe(3);
    expect(attempts.of(recordAt('8'))).toBe(1);
    expect(attempts.of(recordAt('7', 1))).toBe(1);
  });

  it('start again for a partition the consumer forgot', () => {
    const attempts = new Attempts();
    const head = recordAt('7');

    attempts.failed(head);
    attempts.forget({ topic: PLACED, partition: 0 });

    expect(attempts.of(head)).toBe(1);
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
        throw Object.assign(new Error('timed out'), { type: 'ERR__TIMED_OUT' });
      },
      async () => {
        ran.push('second');
        throw new BrokerUnavailableError('ERR__TRANSPORT');
      },
      async () => {
        ran.push('third');
      },
    ]);

    expect(await failureOf(handlers, anEvent('evt-1'), delivery)).toBe('ERR__TIMED_OUT');
    expect(ran).toEqual(['first', 'second', 'third']);
  });
});

describe('a request to the cluster within a time limit', () => {
  it('answers what the request answers in time', async () => {
    expect(await within(Promise.resolve('metadata'), 1_000, 'ERR__TIMED_OUT')).toBe('metadata');
  });

  it('rejects with BROKER_UNAVAILABLE when the request does not settle in time', async () => {
    const never = new Promise<never>(() => undefined);

    await expect(within(never, 5, 'ERR__TIMED_OUT')).rejects.toEqual(new BrokerUnavailableError('ERR__TIMED_OUT'));
  });
});
