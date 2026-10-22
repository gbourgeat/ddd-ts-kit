import { AggregateRoot, type DomainEvent } from '../../../src';

/** An aggregate that records one named event per intention. */
export class Cart extends AggregateRoot {
  private constructor(id: string) {
    super(id);
  }

  static open(id: string): Cart {
    const cart = new Cart(id);

    cart.note('opened');

    return cart;
  }

  static rehydrate(id: string): Cart {
    return new Cart(id);
  }

  add(sku: string): void {
    this.note(`added-${sku}`);
  }

  empty(): void {
    this.note('emptied');
  }

  private note(fact: string): void {
    const event: DomainEvent = { name: `shop.cart.${fact}`, aggregateId: this.id, occurredAt: new Date(0) };

    this.record(event);
  }
}
