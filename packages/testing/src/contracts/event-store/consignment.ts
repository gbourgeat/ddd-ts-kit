import { EventSourcedAggregate, type AggregateHistory, type Appliers } from '@ddd-ts-kit/kernel';
import { ConsignmentRegistered } from './consignment-registered';
import { ConsignmentWeighed } from './consignment-weighed';

export type ConsignmentEvent = ConsignmentRegistered | ConsignmentWeighed;

const AT = new Date('2026-03-01T10:00:00.000Z');

/** The event-sourced aggregate of the contract: born registered, weighed any number of times. */
export class Consignment extends EventSourcedAggregate<ConsignmentEvent> {
  private grams = 0;

  private constructor(id: string) {
    super(id);
  }

  static register(id: string): Consignment {
    const consignment = new Consignment(id);

    consignment.record(new ConsignmentRegistered(id, AT));

    return consignment;
  }

  static rehydrate(id: string, history: AggregateHistory<ConsignmentEvent>): Consignment {
    return new Consignment(id).replay(history);
  }

  weigh(grams: number): this {
    this.record(new ConsignmentWeighed(this.id, AT, grams));

    return this;
  }

  get weight(): number {
    return this.grams;
  }

  protected appliers(): Appliers<ConsignmentEvent> {
    return {
      'shipping.consignment.registered': () => undefined,
      'shipping.consignment.weighed': (event) => this.applyWeighed(event),
    };
  }

  private applyWeighed(event: ConsignmentWeighed): void {
    this.grams = event.grams;
  }
}
