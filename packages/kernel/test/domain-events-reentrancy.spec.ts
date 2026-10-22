import { describe, expect, it } from 'vitest';
import { Command, InMemoryCommandBus, unitOfWorkMiddleware } from '../src';
import { aBench } from './support/shop/a-bench';
import { Cart } from './support/shop/cart';
import { RecordingUnitOfWork } from './support/shop/recording-unit-of-work';

class OpenCart extends Command<undefined> {
  constructor(readonly id: string) {
    super();
  }
}

describe('events recorded while events are dispatched', () => {
  it('wait behind the ones already announced: one chain, in recording order, without recursion', async () => {
    const { carts, dispatcher, heard, hear } = aBench();
    const journal: string[] = [];

    dispatcher.on('shop.cart.opened', async (event) => {
      if (event.aggregateId !== 'c1') {
        return;
      }

      await carts.save(Cart.open('c2'));
      journal.push(`saved c2 after hearing ${heard.length} event(s)`);
    });

    hear('shop.cart.opened', 'shop.cart.added-book');

    const cart = Cart.open('c1');

    cart.add('book');
    await carts.save(cart);

    expect(heard).toEqual(['shop.cart.opened', 'shop.cart.added-book', 'shop.cart.opened']);
    expect(journal).toEqual(['saved c2 after hearing 0 event(s)']);
  });

  it('fails the first save when a handler of a later link of the chain fails', async () => {
    const { carts, dispatcher } = aBench();

    dispatcher.on('shop.cart.opened', async (event) => {
      if (event.aggregateId === 'c1') {
        await carts.save(Cart.open('c2'));
      } else {
        throw new Error('second link failed');
      }
    });

    await expect(carts.save(Cart.open('c1'))).rejects.toThrow('second link failed');
  });

  it('keeps two saves running side by side apart: each dispatches its own events', async () => {
    const { carts, dispatcher, heard } = aBench();

    dispatcher.on('shop.cart.opened', async (event) => {
      await new Promise((resolve) => setTimeout(resolve, event.aggregateId === 'c1' ? 10 : 1));
      heard.push(`${event.aggregateId} opened`);
    });

    await Promise.all([carts.save(Cart.open('c1')), carts.save(Cart.open('c2'))]);

    expect(heard).toEqual(['c2 opened', 'c1 opened']);
  });

  it('opens a chain of its own for a save made after the first one is over', async () => {
    const { carts, dispatcher, heard, hear } = aBench();
    let later: Promise<void> = Promise.resolve();

    dispatcher.on('shop.cart.opened', async (event) => {
      if (event.aggregateId !== 'c1') {
        return;
      }

      later = new Promise((resolve) => setTimeout(resolve, 5)).then(() => carts.save(Cart.open('c2')));
    });

    hear('shop.cart.opened');
    await carts.save(Cart.open('c1'));
    await later;

    expect(heard).toEqual(['shop.cart.opened', 'shop.cart.opened']);
  });
});

describe('the dispatch and the unit of work', () => {
  function aBus(journal: string[]): { bus: InMemoryCommandBus; bench: ReturnType<typeof aBench> } {
    const bench = aBench();
    const bus = new InMemoryCommandBus().use(unitOfWorkMiddleware(new RecordingUnitOfWork(journal)));

    bus.register(OpenCart, {
      execute: async ({ id }) => {
        await bench.carts.save(Cart.open(id));
        journal.push(`saved ${id}`);

        return undefined;
      },
    });

    return { bus, bench };
  }

  it('runs the handlers inside the unit of work of the command, once its handler returned and before it commits', async () => {
    const journal: string[] = [];
    const { bus, bench } = aBus(journal);

    bench.dispatcher.on('shop.cart.opened', async () => void journal.push('handled'));
    await bus.execute(new OpenCart('c1'));

    expect(journal).toEqual(['begin', 'saved c1', 'handled', 'commit']);
  });

  it('fails the command and commits nothing when a handler fails', async () => {
    const journal: string[] = [];
    const { bus, bench } = aBus(journal);

    bench.dispatcher.on('shop.cart.opened', async () => {
      throw new Error('handler failed');
    });

    await expect(bus.execute(new OpenCart('c1'))).rejects.toThrow('handler failed');
    expect(journal).toEqual(['begin', 'saved c1', 'rollback']);
  });

  it('queues the events of a command sent by a handler behind the ones waiting: dispatched once, before the outermost commit', async () => {
    const journal: string[] = [];
    const { bus, bench } = aBus(journal);

    bench.dispatcher.on('shop.cart.opened', async (event) => {
      journal.push(`handling ${event.aggregateId}`);

      if (event.aggregateId === 'c1') {
        await bus.execute(new OpenCart('c2'));
      }
    });

    await bus.execute(new OpenCart('c1'));

    expect(journal).toEqual([
      'begin',
      'saved c1',
      'handling c1',
      'begin',
      'saved c2',
      'commit',
      'handling c2',
      'commit',
    ]);
  });

  it('still dispatches outside of any unit of work: the state is written, then the handlers run', async () => {
    const { carts, dispatcher } = aBench();

    dispatcher.on('shop.cart.opened', async () => {
      throw new Error('handler failed');
    });

    await expect(carts.save(Cart.open('c1'))).rejects.toThrow('handler failed');
    expect(carts.saved).toEqual(['c1']);
  });
});
