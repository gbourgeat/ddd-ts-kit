import { describe, expect, it } from 'vitest';
import { deadTopicOf } from '../src/topology/dead-topic-of';
import { replayGroupOf } from '../src/topology/replay-group-of';
import { topologyOf } from '../src/topology/topology-of';
import type { TopologySettings } from '../src/topology/topology-settings';
import { PLACED } from './support/events';

const ISSUED = 'billing.invoice.issued';

const SHIPPED = 'shipping.parcel.shipped';

const settings: TopologySettings = {
  topicOf: (type) => type,
  publishedTypes: [ISSUED],
  partitions: 6,
  replicationFactor: 3,
};

const sized = { partitions: 6, replicationFactor: 3 };

describe('the topology of a bus', () => {
  it('lists the topics it publishes to and consumes, the dead topics and the groups', () => {
    const topology = topologyOf(settings, [
      { consumer: 'billing', type: PLACED },
      { consumer: 'billing', type: SHIPPED },
      { consumer: 'shipping', type: PLACED },
    ]);

    expect(topology).toEqual({
      topics: [
        { name: ISSUED, role: 'events', ...sized },
        { name: PLACED, role: 'events', ...sized },
        { name: `billing.${PLACED}.dead`, role: 'dead', ...sized },
        { name: SHIPPED, role: 'events', ...sized },
        { name: `billing.${SHIPPED}.dead`, role: 'dead', ...sized },
        { name: `shipping.${PLACED}.dead`, role: 'dead', ...sized },
      ],
      groups: [
        { groupId: 'billing', topics: [PLACED, SHIPPED] },
        { groupId: 'shipping', topics: [PLACED] },
      ],
    });
  });

  it('names each topic and each group once', () => {
    const topology = topologyOf({ ...settings, publishedTypes: [PLACED, PLACED] }, [
      { consumer: 'billing', type: PLACED },
      { consumer: 'billing', type: PLACED },
    ]);

    expect(topology).toEqual({
      topics: [
        { name: PLACED, role: 'events', ...sized },
        { name: `billing.${PLACED}.dead`, role: 'dead', ...sized },
      ],
      groups: [{ groupId: 'billing', topics: [PLACED] }],
    });
  });

  it('names the topics by the routing of the bus', () => {
    const topology = topologyOf({ ...settings, topicOf: () => 'all-events', publishedTypes: [ISSUED] }, [
      { consumer: 'billing', type: PLACED },
      { consumer: 'billing', type: SHIPPED },
    ]);

    expect(topology.topics.map(({ name }) => name)).toEqual(['all-events', 'billing.all-events.dead']);
    expect(topology.groups).toEqual([{ groupId: 'billing', topics: ['all-events'] }]);
  });

  it('is empty for a bus that neither publishes nor consumes', () => {
    expect(topologyOf({ ...settings, publishedTypes: [] }, [])).toEqual({ topics: [], groups: [] });
  });

  it('gives each consumer its own dead topic and its own replay group', () => {
    expect(deadTopicOf('billing', PLACED)).toBe(`billing.${PLACED}.dead`);
    expect(deadTopicOf('shipping', PLACED)).not.toBe(deadTopicOf('billing', PLACED));
    expect(replayGroupOf('billing')).toBe('billing.replay');
    expect(replayGroupOf('shipping')).not.toBe(replayGroupOf('billing'));
  });
});
