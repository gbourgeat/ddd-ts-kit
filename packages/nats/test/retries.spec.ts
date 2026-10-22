import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ATTEMPT_HEADER,
  DEAD_REASON_HEADER,
  ERROR_CODE_HEADER,
  SOURCE_HEADER,
  type NatsDelivery,
  type NatsFailure,
} from '../src';
import type { Broker } from './support/broker';
import { BROKERS } from './support/brokers';
import { MAX_ATTEMPTS, RETRY_DELAY_MS } from './support/environment';
import { PLACED, anEvent } from './support/events';
import { deliveriesOf, failuresOf } from './support/hooks';
import { recorder } from './support/recorder';
import { unique } from './support/unique';

describe.each(BROKERS)('NatsEventBus: retries, %s', { timeout: 30_000 }, (_name, connect) => {
  let broker: Broker;

  beforeEach(async () => {
    broker = await connect();
  });

  afterEach(async () => {
    await broker.dispose();
  });

  it('delivers an event again, after the delay, when its handler failed', async () => {
    const consumer = unique('billing');
    const reported: NatsFailure[] = [];
    const settled: NatsDelivery[] = [];
    const bus = broker.bus({ consumer, onFailure: failuresOf(reported), onDelivery: deliveriesOf(settled) });
    const billing = recorder(1);
    const started = Date.now();

    bus.subscribe(PLACED, billing.handler);

    await bus.publish([anEvent('evt-1')]);
    await broker.settled(bus);

    expect(billing.ids()).toEqual(['evt-1', 'evt-1']);
    expect(Date.now() - started).toBeGreaterThanOrEqual(RETRY_DELAY_MS);

    expect(settled.map(({ attempt, outcome }) => `${String(attempt)}:${outcome}`)).toEqual([
      '1:retried',
      '2:acknowledged',
    ]);

    expect(reported).toEqual([
      {
        kind: 'handler',
        consumer: broker.namesOf({ consumer, type: PLACED }).durable,
        eventId: 'evt-1',
        eventType: PLACED,
        code: 'INVOICING_FAILED',
        attempt: 1,
        dead: false,
      },
    ]);
  });

  it('moves an event to the dead-letter stream once its attempts are spent, with a code and no message', async () => {
    const consumer = unique('billing');
    const reported: NatsFailure[] = [];
    const bus = broker.bus({ consumer, onFailure: failuresOf(reported) });
    const billing = recorder(Number.POSITIVE_INFINITY);

    bus.subscribe(PLACED, billing.handler);
    const names = broker.namesOf({ consumer, type: PLACED });

    await bus.publish([anEvent('evt-1')]);
    await broker.settled(bus);
    const dead = await broker.dead();

    expect(billing.received).toHaveLength(MAX_ATTEMPTS);
    expect(reported.map((failure) => failure.kind === 'handler' && failure.dead)).toEqual([false, false, true]);
    expect(dead).toHaveLength(1);
    expect(dead[0]?.subject).toBe(names.deadSubject);

    expect(dead[0]?.headers).toMatchObject({
      [ATTEMPT_HEADER]: String(MAX_ATTEMPTS),
      [ERROR_CODE_HEADER]: 'INVOICING_FAILED',
      [DEAD_REASON_HEADER]: 'max-attempts',
      [SOURCE_HEADER]: `${broker.stream}/1`,
      'x-event-type': PLACED,
    });

    expect(JSON.parse(dead[0]?.body ?? '')).toEqual(anEvent('evt-1'));
    expect(JSON.stringify([reported, dead])).not.toContain('jane.doe');
    expect(await broker.waitingFor(names.durable)).toBe(0);
  });
});
