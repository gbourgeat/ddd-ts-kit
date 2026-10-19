import { describe, expect, it } from 'vitest';
import { dispatchingOnSave, type DomainEvent } from '../src/index.js';
import { aBench } from './support/shop/a-bench.js';
import { Cart } from './support/shop/cart.js';
import { InMemoryCarts } from './support/shop/in-memory-carts.js';

describe('domain events leave with the save', () => {
  it('dispatches what the aggregate recorded, in recording order, once the save resolved', async () => {
    const { carts, heard, hear } = aBench();
    const cart = Cart.open('c1');

    hear('shop.cart.opened', 'shop.cart.added-book', 'shop.cart.added-pen');
    cart.add('book');
    cart.add('pen');
    await carts.save(cart);

    expect(heard).toEqual(['shop.cart.opened', 'shop.cart.added-book', 'shop.cart.added-pen']);
    expect(cart.pullEvents()).toEqual([]);
    expect(carts.saved).toEqual(['c1']);
  });

  it('follows every method handed an aggregate or an array of them, in the order of the arguments', async () => {
    const { carts, heard, hear } = aBench();
    const first = Cart.rehydrate('c1');
    const second = Cart.rehydrate('c2');

    hear('shop.cart.added-book', 'shop.cart.added-pen', 'shop.cart.emptied');
    second.add('pen');
    first.add('book');
    await carts.saveAll([first, second]);
    first.empty();
    await carts.remove(first);

    expect(heard).toEqual(['shop.cart.added-book', 'shop.cart.added-pen', 'shop.cart.emptied']);
  });

  it('leaves alone a method that is handed no aggregate', async () => {
    const { carts, heard, hear } = aBench();
    const cart = Cart.open('c1');

    hear('shop.cart.opened');
    await carts.findById('c1');
    await carts.removeById('c1');

    expect(carts.count()).toBe(0);
    expect(heard).toEqual([]);
    expect(cart.pullEvents()).toHaveLength(1);
  });

  it('keeps the events on the aggregate when the save fails, and dispatches them with the save that succeeds', async () => {
    const { carts, heard, hear } = aBench();
    const cart = Cart.open('c1');

    hear('shop.cart.opened');
    carts.failNextSave = new Error('connection lost');

    await expect(carts.save(cart)).rejects.toThrow('connection lost');
    expect(heard).toEqual([]);

    await carts.save(cart);

    expect(heard).toEqual(['shop.cart.opened']);
  });

  it('dispatches at a second save only what was recorded since the first', async () => {
    const { carts, heard, hear } = aBench();
    const cart = Cart.open('c1');

    hear('shop.cart.opened', 'shop.cart.added-book');
    await carts.save(cart);
    await carts.save(cart);
    cart.add('book');
    await carts.save(cart);

    expect(heard).toEqual(['shop.cart.opened', 'shop.cart.added-book']);
  });

  it('fails the save with what a handler threw, and drops the events still waiting', async () => {
    const { carts, dispatcher, heard, hear } = aBench();
    const cart = Cart.open('c1');

    dispatcher.on('shop.cart.opened', async () => {
      throw new Error('stock unreachable');
    });

    hear('shop.cart.added-book');
    cart.add('book');

    await expect(carts.save(cart)).rejects.toThrow('stock unreachable');
    expect(heard).toEqual([]);
    expect(carts.saved).toEqual(['c1']);
  });
});

describe('a repository adapter and the dispatch', () => {
  it('dispatches nothing twice when the adapter pulled the events itself: nothing is left', async () => {
    class PullingCarts extends InMemoryCarts {
      readonly pulled: DomainEvent[] = [];

      override async save(cart: Cart): Promise<void> {
        this.pulled.push(...cart.pullEvents());
      }
    }

    const bench = aBench();
    const carts = dispatchingOnSave(new PullingCarts(), () => bench.dispatcher);

    bench.hear('shop.cart.opened');
    await carts.save(Cart.open('c1'));

    expect(carts.pulled).toHaveLength(1);
    expect(bench.heard).toEqual([]);
  });

  it('is wrapped in place, once: the same object, nothing enumerable added', () => {
    const bench = aBench();
    const carts = new InMemoryCarts();
    const before = Object.keys(carts);
    const wrapped = dispatchingOnSave(carts, () => bench.dispatcher);
    const save = wrapped.save;

    expect(wrapped).toBe(carts);
    expect(dispatchingOnSave(wrapped, () => bench.dispatcher).save).toBe(save);
    expect(Object.keys(carts)).toEqual(before);
    expect(save.name).toBe('save');
  });

  it('dispatches for a sealed repository too, reached through a proxy', async () => {
    const bench = aBench();
    const sealed = Object.seal(new InMemoryCarts());
    const carts = dispatchingOnSave(sealed, () => bench.dispatcher);

    bench.hear('shop.cart.opened');
    await carts.save(Cart.open('c1'));

    expect(carts).not.toBe(sealed);
    expect(carts).toBeInstanceOf(InMemoryCarts);
    expect(sealed.saved).toEqual(['c1']);
    expect(bench.heard).toEqual(['shop.cart.opened']);
  });

  it('asks for the dispatcher at each dispatch, so it may be replaced after the wrapping', async () => {
    const first = aBench();
    const second = aBench();
    let current = first.dispatcher;
    const carts = dispatchingOnSave(new InMemoryCarts(), () => current);

    first.hear('shop.cart.opened');
    second.hear('shop.cart.opened');
    current = second.dispatcher;
    await carts.save(Cart.open('c1'));

    expect(first.heard).toEqual([]);
    expect(second.heard).toEqual(['shop.cart.opened']);
  });

  it('follows a method written without async that answers a promise, and hands back as it is what has nothing to dispatch', async () => {
    class CartNotFound extends Error {}

    /** An adapter over a driver with callbacks: its methods answer promises of their own, or plain values. */
    class LedgerCarts {
      readonly saved: string[] = [];

      readonly notFound = CartNotFound;

      readonly pending = Promise.resolve(undefined);

      save(cart: Cart): Promise<void> {
        this.saved.push(cart.id);

        return Promise.resolve();
      }

      findById(): Promise<undefined> {
        return this.pending;
      }

      lastSaved(): string | null {
        return this.saved.at(-1) ?? null;
      }

      receipt(cart: Cart): { readonly id: string; readonly then: string } {
        return { id: cart.id, then: 'printed later' };
      }

      summary(cart: Cart): { readonly id: string } {
        return { id: cart.id };
      }
    }

    const bench = aBench();
    const carts = dispatchingOnSave(new LedgerCarts(), () => bench.dispatcher);
    const kept = Cart.open('c2');

    bench.hear('shop.cart.opened');

    expect(carts.lastSaved()).toBeNull();
    expect(carts.findById()).toBe(carts.pending);
    expect(carts.receipt(kept)).toEqual({ id: 'c2', then: 'printed later' });
    expect(carts.summary(kept)).toEqual({ id: 'c2' });
    expect(new carts.notFound('c9')).toBeInstanceOf(CartNotFound);

    await carts.save(Cart.open('c1'));

    expect(bench.heard).toEqual(['shop.cart.opened']);
    expect(carts.lastSaved()).toBe('c1');
    expect(kept.pullEvents()).toHaveLength(1);
  });
});
