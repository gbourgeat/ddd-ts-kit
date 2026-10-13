import { EventSerializer, EventSourcedRepository, defineStoredEvent, type EventStore } from '@ddd-ts-kit/kernel';
import { Consignment, type ConsignmentEvent } from './consignment.js';
import { ConsignmentRegistered } from './consignment-registered.js';
import { ConsignmentWeighed } from './consignment-weighed.js';

/** The repository adapter of the contract: it delegates to `EventSourcedRepository`, and knows nothing of events. */
export class Consignments {
  private readonly streams: EventSourcedRepository<Consignment, ConsignmentEvent>;

  constructor(store: EventStore) {
    this.streams = new EventSourcedRepository({
      store,
      category: 'shipping.consignment',
      serializer: new EventSerializer<ConsignmentEvent>({
        'shipping.consignment.registered': defineStoredEvent(ConsignmentRegistered, {
          version: 1,
          encode: () => ({}),
          decode: (_data, { aggregateId, occurredAt }) => new ConsignmentRegistered(aggregateId, occurredAt),
        }),
        'shipping.consignment.weighed': defineStoredEvent(ConsignmentWeighed, {
          version: 1,
          encode: (event) => ({ grams: event.grams }),
          decode: (data, { aggregateId, occurredAt }) =>
            new ConsignmentWeighed(aggregateId, occurredAt, data.number('grams')),
        }),
      }),
      rehydrate: (id, history) => Consignment.rehydrate(id, history),
    });
  }

  findById(id: string): Promise<Consignment | undefined> {
    return this.streams.findById(id);
  }

  save(consignment: Consignment): Promise<void> {
    return this.streams.save(consignment);
  }
}
