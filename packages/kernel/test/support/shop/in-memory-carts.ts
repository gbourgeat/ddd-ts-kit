import type { Repository } from '../../../src';
import { Cart } from './cart';

/** A repository adapter as the kit asks for it: it persists, and knows nothing of events. */
export class InMemoryCarts implements Repository<Cart> {
  readonly saved: string[] = [];

  failNextSave: Error | undefined;

  async findById(id: string): Promise<Cart | undefined> {
    return this.saved.includes(id) ? Cart.rehydrate(id) : undefined;
  }

  async save(cart: Cart): Promise<void> {
    const failure = this.failNextSave;

    this.failNextSave = undefined;

    if (failure !== undefined) {
      throw failure;
    }

    this.saved.push(cart.id);
  }

  async saveAll(carts: readonly Cart[]): Promise<void> {
    this.saved.push(...carts.map((cart) => cart.id));
  }

  async remove(cart: Cart): Promise<void> {
    this.saved.splice(this.saved.indexOf(cart.id), 1);
  }

  async removeById(id: string): Promise<void> {
    this.saved.splice(this.saved.indexOf(id), 1);
  }

  count(): number {
    return this.saved.length;
  }
}
