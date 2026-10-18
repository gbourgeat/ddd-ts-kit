import { describe, expect, it } from 'vitest';
import { queueNamesOf } from '../src/topology/queue-names-of.js';
import { topologyOf } from '../src/topology/topology-of.js';
import type { TopologySettings } from '../src/topology/topology-settings.js';
import { PLACED } from './support/events.js';

const SHIPPED = 'shipping.parcel.shipped';

const settings: TopologySettings = { exchange: 'shop-events', queueType: 'quorum', retryDelayMs: 5_000 };

const viaDefaultExchange = { 'x-dead-letter-exchange': '' };

describe('the topology of a bus', () => {
  it('lists its exchange, a work, a retry and a dead queue per binding, and one binding per work queue', () => {
    const topology = topologyOf(settings, [
      { consumer: 'billing', type: PLACED },
      { consumer: 'shipping', type: SHIPPED },
    ]);

    expect(topology.exchanges).toEqual([{ name: 'shop-events', type: 'topic', durable: true }]);

    expect(topology.queues.map(({ name, role }) => [name, role])).toEqual([
      [`billing.${PLACED}`, 'work'],
      [`billing.${PLACED}.retry`, 'retry'],
      [`billing.${PLACED}.dead`, 'dead'],
      [`shipping.${SHIPPED}`, 'work'],
      [`shipping.${SHIPPED}.retry`, 'retry'],
      [`shipping.${SHIPPED}.dead`, 'dead'],
    ]);

    expect(topology.bindings).toEqual([
      { exchange: 'shop-events', queue: `billing.${PLACED}`, routingKey: PLACED },
      { exchange: 'shop-events', queue: `shipping.${SHIPPED}`, routingKey: SHIPPED },
    ]);
  });

  it('sends a refused message to its dead queue, and an expired retry back to its work queue', () => {
    const [work, retry, dead] = topologyOf(settings, [{ consumer: 'billing', type: PLACED }]).queues;
    const quorum = { 'x-queue-type': 'quorum' };

    expect(work).toEqual({
      name: `billing.${PLACED}`,
      role: 'work',
      durable: true,
      arguments: { ...quorum, ...viaDefaultExchange, 'x-dead-letter-routing-key': `billing.${PLACED}.dead` },
    });

    expect(retry).toEqual({
      name: `billing.${PLACED}.retry`,
      role: 'retry',
      durable: true,
      arguments: {
        ...quorum,
        ...viaDefaultExchange,
        'x-message-ttl': 5_000,
        'x-dead-letter-routing-key': `billing.${PLACED}`,
        'x-dead-letter-strategy': 'at-least-once',
        'x-overflow': 'reject-publish',
      },
    });

    expect(dead).toEqual({ name: `billing.${PLACED}.dead`, role: 'dead', durable: true, arguments: quorum });
  });

  it('declares classic queues without the lossless dead-lettering only a quorum queue has', () => {
    const classic = topologyOf({ ...settings, queueType: 'classic', retryDelayMs: 250 }, [
      { consumer: 'billing', type: PLACED },
    ]);

    expect(classic.queues.map(({ arguments: given }) => given)).toEqual([
      { 'x-queue-type': 'classic', ...viaDefaultExchange, 'x-dead-letter-routing-key': `billing.${PLACED}.dead` },
      {
        'x-queue-type': 'classic',
        ...viaDefaultExchange,
        'x-message-ttl': 250,
        'x-dead-letter-routing-key': `billing.${PLACED}`,
      },
      { 'x-queue-type': 'classic' },
    ]);
  });

  it('has its exchange only for a bus that only publishes', () => {
    expect(topologyOf(settings, [])).toEqual({
      exchanges: [{ name: 'shop-events', type: 'topic', durable: true }],
      queues: [],
      bindings: [],
    });
  });
});

describe('the queues of a binding', () => {
  it('are named after the consumer and the event type', () => {
    expect(queueNamesOf({ consumer: 'billing', type: PLACED })).toEqual({
      work: `billing.${PLACED}`,
      retry: `billing.${PLACED}.retry`,
      dead: `billing.${PLACED}.dead`,
    });
  });

  it('keep each consumer apart from the others', () => {
    const billing = queueNamesOf({ consumer: 'billing', type: PLACED });
    const shipping = queueNamesOf({ consumer: 'shipping', type: PLACED });

    expect(shipping.work).not.toBe(billing.work);
    expect(shipping.retry).not.toBe(billing.retry);
    expect(shipping.dead).not.toBe(billing.dead);
  });
});
