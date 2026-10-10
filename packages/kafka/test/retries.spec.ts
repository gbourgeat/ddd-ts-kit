import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ATTEMPT_HEADER,
  DEAD_REASON_HEADER,
  ERROR_CODE_HEADER,
  SOURCE_HEADER,
  deadTopicOf,
  type KafkaDelivery,
  type KafkaFailure,
} from '../src/index.js';
import { Broker } from './support/broker.js';
import { KAFKA_BROKERS, MAX_ATTEMPTS, RETRY_DELAY_MS } from './support/environment.js';
import { PLACED, anEvent } from './support/events.js';
import { deliveriesOf, failuresOf } from './support/hooks.js';
import { InvoicingFailed } from './support/invoicing-failed.js';
import { recorder } from './support/recorder.js';

describe.skipIf(KAFKA_BROKERS === undefined)('KafkaEventBus: retries', { timeout: 60_000 }, () => {
  let broker: Broker;

  beforeEach(async () => {
    broker = await Broker.connect(KAFKA_BROKERS ?? '');
  });

  afterEach(async () => {
    await broker.dispose();
  }, 30_000);

  it('delivers an event again, after the delay, when its handler failed', async () => {
    const consumer = broker.consumer('billing');
    const reported: KafkaFailure[] = [];
    const settled: KafkaDelivery[] = [];
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
        consumer,
        topic: broker.topicOf(PLACED),
        eventId: 'evt-1',
        eventType: PLACED,
        code: 'INVOICING_FAILED',
        attempt: 1,
        dead: false,
      },
    ]);
  });

  it('copies an event to the dead-letter topic once its attempts are spent, with a code and no message, and moves on', async () => {
    const consumer = broker.consumer('billing');
    const reported: KafkaFailure[] = [];
    const bus = broker.bus({ consumer, keyOf: () => 'order-1', onFailure: failuresOf(reported) });
    const handled: string[] = [];

    bus.subscribe(PLACED, async (event) => {
      handled.push(event.id);

      if (event.id === 'evt-1') {
        throw new InvoicingFailed();
      }
    });

    const topic = broker.topicOf(PLACED);

    await bus.publish([anEvent('evt-1'), anEvent('evt-2')]);
    await broker.settled(bus);
    const dead = await broker.recordsOf(deadTopicOf(consumer, topic));

    expect(handled).toEqual(['evt-1', 'evt-1', 'evt-1', 'evt-2']);
    expect(reported.map((failure) => failure.kind === 'handler' && failure.dead)).toEqual([false, false, true]);
    expect(dead).toHaveLength(1);
    expect(dead[0]?.key).toBe('order-1');

    expect(dead[0]?.headers).toMatchObject({
      'x-event-id': 'evt-1',
      [ATTEMPT_HEADER]: String(MAX_ATTEMPTS),
      [ERROR_CODE_HEADER]: 'INVOICING_FAILED',
      [DEAD_REASON_HEADER]: 'max-attempts',
      [SOURCE_HEADER]: `${topic}/0/0`,
    });

    expect(JSON.parse(dead[0]?.value ?? '')).toEqual(anEvent('evt-1'));
    expect(JSON.stringify([reported, dead])).not.toContain('jane.doe');
    expect(await broker.lagOf(consumer, [topic])).toBe(0);
  });
});
