import { describe, expect, it } from 'vitest';
import { bindingNamesOf } from '../src/topology/binding-names-of';
import { deadStreamOf } from '../src/topology/dead-stream-of';
import { topologyOf } from '../src/topology/topology-of';
import type { TopologySettings } from '../src/topology/topology-settings';
import { PLACED } from './support/events';

const SHIPPED = 'shipping.parcel.shipped';

const settings: TopologySettings = {
  stream: 'shop-events',
  subjectPrefix: 'events',
  storage: 'file',
  replicas: 3,
  duplicateWindowMs: 120_000,
  ackWaitMs: 30_000,
  maxAttempts: 5,
};

const kept = { storage: 'file', replicas: 3, duplicateWindowMs: 120_000 };

describe('the topology of a bus', () => {
  it('lists the stream of the events, its dead-letter stream and one durable consumer per binding', () => {
    const topology = topologyOf(settings, [
      { consumer: 'billing', type: PLACED },
      { consumer: 'billing', type: SHIPPED },
      { consumer: 'shipping', type: PLACED },
    ]);

    const limits = { stream: 'shop-events', ackWaitMs: 30_000, maxDeliver: 10 };

    expect(topology).toEqual({
      streams: [
        { name: 'shop-events', role: 'events', subjects: ['events.>'], ...kept },
        { name: 'shop-events-dead', role: 'dead', subjects: ['dead.events.>'], ...kept },
      ],
      consumers: [
        { name: 'billing_ordering_order_placed', filterSubject: `events.${PLACED}`, ...limits },
        { name: 'billing_shipping_parcel_shipped', filterSubject: `events.${SHIPPED}`, ...limits },
        { name: 'shipping_ordering_order_placed', filterSubject: `events.${PLACED}`, ...limits },
      ],
    });
  });

  it('lets the server deliver a message twice as often as the bus retries it, so it is still parked', () => {
    const [consumer] = topologyOf({ ...settings, maxAttempts: 7 }, [{ consumer: 'billing', type: PLACED }]).consumers;

    expect(consumer?.maxDeliver).toBe(14);
  });

  it('names the subjects by the prefix of the bus', () => {
    const topology = topologyOf({ ...settings, subjectPrefix: 'shop' }, [{ consumer: 'billing', type: PLACED }]);

    expect(topology.streams.map(({ subjects }) => subjects)).toEqual([['shop.>'], ['dead.shop.>']]);
    expect(topology.consumers.map(({ filterSubject }) => filterSubject)).toEqual([`shop.${PLACED}`]);
  });

  it('has its streams and no consumer for a bus that only publishes', () => {
    const topology = topologyOf(settings, []);

    expect(topology.streams.map(({ name }) => name)).toEqual(['shop-events', 'shop-events-dead']);
    expect(topology.consumers).toEqual([]);
  });
});

describe('the names of a binding', () => {
  it('are the durable consumer, the subject of its events and the subject of its dead letters', () => {
    expect(bindingNamesOf({ consumer: 'billing', type: PLACED }, 'events')).toEqual({
      durable: 'billing_ordering_order_placed',
      subject: `events.${PLACED}`,
      deadSubject: `dead.events.billing.${PLACED}`,
    });
  });

  it('give a durable name with neither dot nor wildcard', () => {
    const names = bindingNamesOf({ consumer: 'billing.eu', type: 'ordering.*.placed>' }, 'events');

    expect(names.durable).toBe('billing_eu_ordering___placed_');
    expect(names.deadSubject).toBe('dead.events.billing_eu.ordering.*.placed>');
  });

  it('keep each consumer apart from the others', () => {
    const billing = bindingNamesOf({ consumer: 'billing', type: PLACED }, 'events');
    const shipping = bindingNamesOf({ consumer: 'shipping', type: PLACED }, 'events');

    expect(shipping.subject).toBe(billing.subject);
    expect(shipping.durable).not.toBe(billing.durable);
    expect(shipping.deadSubject).not.toBe(billing.deadSubject);
  });
});

describe('the dead-letter stream', () => {
  it('is named after the stream of the events', () => {
    expect(deadStreamOf('integration-events')).toBe('integration-events-dead');
  });
});
