import { AggregateRoot } from '@ddd-ts-kit/kernel';

/** The aggregate of the contract: one event recorded per intention. */
export class Parcel extends AggregateRoot {
  static readonly REGISTERED = 'shipping.parcel.registered';

  static readonly WEIGHED = 'shipping.parcel.weighed';

  private constructor(id: string) {
    super(id);
  }

  static register(id: string): Parcel {
    const parcel = new Parcel(id);

    parcel.note(Parcel.REGISTERED);

    return parcel;
  }

  weigh(): this {
    this.note(Parcel.WEIGHED);

    return this;
  }

  private note(name: string): void {
    this.record({ name, aggregateId: this.id, occurredAt: new Date(0) });
  }
}
