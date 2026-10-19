import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ATTEMPT_HEADER,
  DEAD_REASON_HEADER,
  ERROR_CODE_HEADER,
  queueNamesOf,
  type RabbitMqDelivery,
  type RabbitMqFailure,
} from '../src/index.js';
import type { Broker } from './support/broker.js';
import { BROKERS } from './support/brokers.js';
import { MAX_ATTEMPTS, RETRY_DELAY_MS } from './support/environment.js';
import { PLACED, anEvent } from './support/events.js';
import { deliveriesOf, failuresOf } from './support/hooks.js';
import { recorder } from './support/recorder.js';
import { unique } from './support/unique.js';

describe.each(BROKERS)('RabbitMqEventBus: retries, %s', { timeout: 30_000 }, (_name, connect) => {
  let broker: Broker;

  beforeEach(async () => {
    broker = await connect();
  });

  afterEach(async () => {
    await broker.dispose();
  });

  it('delivers an event again, after the delay, when its handler failed', async () => {
    const reported: RabbitMqFailure[] = [];
    const settled: RabbitMqDelivery[] = [];
    const bus = broker.bus({ onFailure: failuresOf(reported), onDelivery: deliveriesOf(settled) });
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
        queue: `${bus.describeTopology().queues[0]?.name ?? ''}`,
        eventId: 'evt-1',
        eventType: PLACED,
        code: 'INVOICING_FAILED',
        attempt: 1,
        dead: false,
      },
    ]);
  });

  it('moves an event to the dead queue once its attempts are spent, with a code and no message', async () => {
    const consumer = unique('billing');
    const reported: RabbitMqFailure[] = [];
    const bus = broker.bus({ consumer, onFailure: failuresOf(reported) });
    const billing = recorder(Number.POSITIVE_INFINITY);

    bus.subscribe(PLACED, billing.handler);
    const queues = queueNamesOf({ consumer, type: PLACED });

    await bus.publish([anEvent('evt-1')]);
    await broker.settled(bus);
    const dead = await broker.take(queues.dead);

    expect(billing.received).toHaveLength(MAX_ATTEMPTS);
    expect(reported.map((failure) => failure.kind === 'handler' && failure.dead)).toEqual([false, false, true]);

    expect(dead?.properties.headers).toMatchObject({
      [ATTEMPT_HEADER]: MAX_ATTEMPTS,
      [ERROR_CODE_HEADER]: 'INVOICING_FAILED',
      [DEAD_REASON_HEADER]: 'max-attempts',
    });

    expect(JSON.parse(dead?.content.toString() ?? '')).toEqual(anEvent('evt-1'));
    expect(JSON.stringify([reported, dead?.properties])).not.toContain('jane.doe');
    expect(await broker.readyIn(queues.work)).toBe(0);
    expect(await broker.readyIn(queues.retry)).toBe(0);
  });
});
