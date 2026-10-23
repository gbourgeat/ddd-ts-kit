import { describe, expect, it } from 'vitest';
import {
  Command,
  InMemoryCommandBus,
  InMemoryDomainEventDispatcher,
  InMemoryErrorReporter,
  InMemoryLogger,
  InMemoryUnitOfWork,
  SaveAfterCommitError,
  dispatchingOnSave,
  reportAfterCommitFailures,
  unitOfWorkMiddleware,
  unitOfWorkStage,
} from '../src';
import { aBench } from './support/shop/a-bench';
import { Cart } from './support/shop/cart';
import { InMemoryCarts } from './support/shop/in-memory-carts';
import { RecordingUnitOfWork } from './support/shop/recording-unit-of-work';

class OpenCarts extends Command<undefined> {
  constructor(
    readonly ids: readonly string[],
    readonly then?: Error,
  ) {
    super();
  }
}

/** A step another command waits for: the order of two commands is told, never left to timers. */
function signal(): { readonly promise: Promise<void>; readonly resolve: () => void } {
  let resolve = (): void => undefined;

  const promise = new Promise<void>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

/** A command bus over a unit of work that notes its transaction, and a bench whose handlers note what they see. */
function aShop() {
  const bench = aBench();
  const journal: string[] = [];
  const unitOfWork = new RecordingUnitOfWork(journal);
  const bus = new InMemoryCommandBus().use(unitOfWorkMiddleware(unitOfWork));

  bus.register(OpenCarts, {
    execute: async ({ ids, then }) => {
      for (const id of ids) {
        await bench.carts.save(Cart.open(id));
        journal.push(`saved ${id}`);
      }

      if (then !== undefined) {
        throw then;
      }

      return undefined;
    },
  });

  const note = (label: string, phase: 'before-commit' | 'after-commit' = 'before-commit'): void => {
    bench.dispatcher.on('shop.cart.opened', async (event) => void journal.push(`${label} ${event.aggregateId}`), {
      phase,
    });
  };

  return { ...bench, journal, unitOfWork, bus, note };
}

describe('domain events of a command wait for the end of its unit of work', () => {
  it('runs every handler after both saves, in recording order, before the commit', async () => {
    const { bus, carts, dispatcher, journal } = aShop();

    dispatcher.on('shop.cart.opened', async (event) => {
      journal.push(`${event.aggregateId} sees ${carts.saved.join(',')}`);
    });

    await bus.execute(new OpenCarts(['c1', 'c2']));

    expect(journal).toEqual(['begin', 'saved c1', 'saved c2', 'c1 sees c1,c2', 'c2 sees c1,c2', 'commit']);
  });

  it('dispatches what a handler saved after the events already waiting, once, without recursion', async () => {
    const { bus, carts, dispatcher, journal } = aShop();

    dispatcher.on('shop.cart.opened', async (event) => {
      journal.push(`handling ${event.aggregateId}`);

      if (event.aggregateId === 'c1') {
        await carts.save(Cart.open('c3'));
      }
    });

    await bus.execute(new OpenCarts(['c1', 'c2']));

    expect(journal).toEqual(['begin', 'saved c1', 'saved c2', 'handling c1', 'handling c2', 'handling c3', 'commit']);
  });

  it('runs no handler of either phase when the command handler throws after a save', async () => {
    const { bus, journal, note } = aShop();

    note('handling');
    note('committed', 'after-commit');

    await expect(bus.execute(new OpenCarts(['c1'], new Error('carrier down')))).rejects.toThrow('carrier down');
    expect(journal).toEqual(['begin', 'saved c1', 'rollback']);
  });

  it('drops the events of the failed command: its retry dispatches each event once', async () => {
    const { bus, journal, note } = aShop();

    note('handling');
    await bus.execute(new OpenCarts(['c1'], new Error('carrier down'))).catch(() => undefined);
    await bus.execute(new OpenCarts(['c1']));

    expect(journal.filter((entry) => entry.startsWith('handling'))).toEqual(['handling c1']);
  });

  it('runs no handler of the earlier saves when a later save rejects', async () => {
    const { carts, dispatcher, heard, hear } = aBench();
    const second = Cart.open('c2');

    hear('shop.cart.opened');

    dispatcher.on('shop.cart.opened', async (event) => void heard.push(`after ${event.aggregateId}`), {
      phase: 'after-commit',
    });

    const failing = new InMemoryUnitOfWork().run(async () => {
      await carts.save(Cart.open('c1'));
      carts.failNextSave = new Error('duplicate key');
      await carts.save(second);
    });

    await expect(failing).rejects.toThrow('duplicate key');
    expect(heard).toEqual([]);
    expect(second.pullEvents()).toHaveLength(1);
  });

  it('fails the command when a before-commit handler fails: rolled back, and no after-commit handler runs', async () => {
    const { bus, dispatcher, journal, note } = aShop();

    note('handling');

    dispatcher.on('shop.cart.opened', async (event) => {
      if (event.aggregateId === 'c2') {
        throw new Error('stock unreachable');
      }
    });

    note('committed', 'after-commit');

    await expect(bus.execute(new OpenCarts(['c1', 'c2']))).rejects.toThrow('stock unreachable');
    expect(journal).toEqual(['begin', 'saved c1', 'saved c2', 'handling c1', 'handling c2', 'rollback']);
  });

  it('runs no after-commit handler when the commit itself fails after the before-commit handlers ran', async () => {
    const { bus, journal, note, unitOfWork } = aShop();

    note('handling');
    note('committed', 'after-commit');
    unitOfWork.failNextCommit = new Error('could not serialize access');

    await expect(bus.execute(new OpenCarts(['c1']))).rejects.toThrow('could not serialize access');
    expect(journal).toEqual(['begin', 'saved c1', 'handling c1', 'rollback']);
  });
});

describe('the after-commit phase', () => {
  it('runs once the unit of work has committed, in the order the events were dispatched', async () => {
    const { bus, journal, note } = aShop();

    note('committed', 'after-commit');
    note('handling');
    await bus.execute(new OpenCarts(['c1', 'c2']));

    expect(journal).toEqual([
      'begin',
      'saved c1',
      'saved c2',
      'handling c1',
      'handling c2',
      'commit',
      'committed c1',
      'committed c2',
    ]);
  });

  it('reports the handler that fails, runs the others and lets the command succeed', async () => {
    const reporter = new InMemoryErrorReporter();
    const logger = new InMemoryLogger();
    const dispatcher = new InMemoryDomainEventDispatcher(reportAfterCommitFailures({ reporter, logger }));
    const carts = dispatchingOnSave(new InMemoryCarts(), () => dispatcher);
    const failure = new Error('cache down');
    const heard: string[] = [];

    dispatcher.on('shop.cart.opened', () => Promise.reject(failure), { phase: 'after-commit' });
    dispatcher.on('shop.cart.opened', async (event) => void heard.push(event.aggregateId), { phase: 'after-commit' });

    await expect(new InMemoryUnitOfWork().run(() => carts.save(Cart.open('c1')))).resolves.toBeUndefined();

    expect(heard).toEqual(['c1']);
    expect(dispatcher.afterCommitFailures.map(({ error }) => error)).toEqual([failure]);

    expect(reporter.reports).toEqual([
      {
        error: failure,
        report: { severity: 'error', origin: 'domain-event', operation: 'after-commit shop.cart.opened' },
      },
    ]);

    expect(logger.entries).toEqual([
      {
        level: 'error',
        message: 'A domain event handler failed after the commit',
        fields: { domainEvent: 'shop.cart.opened', errorType: 'Error' },
      },
    ]);
  });

  it('refuses a save made by an after-commit handler before it writes, and lets it send a command', async () => {
    const { bus, carts, dispatcher, journal, note } = aShop();

    dispatcher.on(
      'shop.cart.opened',
      async (event) => {
        if (event.aggregateId === 'c1') {
          await carts.save(Cart.open('c9'));
        }
      },
      { phase: 'after-commit' },
    );

    dispatcher.on(
      'shop.cart.opened',
      async (event) => {
        if (event.aggregateId === 'c1') {
          await bus.execute(new OpenCarts(['c2']));
        }
      },
      { phase: 'after-commit' },
    );

    note('handling');
    await bus.execute(new OpenCarts(['c1']));

    expect(dispatcher.afterCommitFailures.map(({ error }) => error)).toEqual([new SaveAfterCommitError('save')]);
    expect(carts.saved).toEqual(['c1', 'c2']);

    expect(journal).toEqual([
      'begin',
      'saved c1',
      'handling c1',
      'commit',
      'begin',
      'saved c2',
      'handling c2',
      'commit',
    ]);
  });

  it('tells where the caller stands in the unit of work', async () => {
    const { carts, dispatcher } = aBench();
    const stages: string[] = [unitOfWorkStage()];

    dispatcher.on('shop.cart.opened', async () => void stages.push(unitOfWorkStage()));
    dispatcher.on('shop.cart.opened', async () => void stages.push(unitOfWorkStage()), { phase: 'after-commit' });

    await new InMemoryUnitOfWork().run(async () => {
      stages.push(unitOfWorkStage());
      await carts.save(Cart.open('c1'));
    });

    expect(stages).toEqual(['outside', 'open', 'before-commit', 'after-commit']);
  });
});

describe('the scope of a unit of work', () => {
  it('is not shared by two commands running side by side: their saves interleave and each dispatches its own events', async () => {
    const { carts, dispatcher } = aBench();
    const seen = new Map<string, string[]>();
    const unitOfWork = new InMemoryUnitOfWork();

    const aSavedOnce = signal();
    const bCommitted = signal();

    const command = async (
      name: string,
      waits: readonly [Promise<void>, Promise<void>],
      afterFirstSave = (): void => undefined,
    ): Promise<void> => {
      const mine: string[] = [];

      seen.set(name, mine);

      await unitOfWork.run(async () => {
        dispatcher.on('shop.cart.opened', async (event) => {
          if (unitOfWorkStage() === 'before-commit' && event.aggregateId.startsWith(name)) {
            mine.push(`${event.aggregateId} after ${carts.saved.length} saves`);
          }
        });

        await waits[0];
        await carts.save(Cart.open(`${name}1`));
        afterFirstSave();
        await waits[1];
        await carts.save(Cart.open(`${name}2`));
      });
    };

    const now = Promise.resolve();

    await Promise.all([
      command('a', [now, bCommitted.promise], aSavedOnce.resolve),
      command('b', [aSavedOnce.promise, now]).then(bCommitted.resolve),
    ]);

    expect(carts.saved).toEqual(['a1', 'b1', 'b2', 'a2']);
    expect(seen.get('b')).toEqual(['b1 after 3 saves', 'b2 after 3 saves']);
    expect(seen.get('a')).toEqual(['a1 after 4 saves', 'a2 after 4 saves']);
  });

  it('is joined by a nested run: one dispatch, at the end of the outermost', async () => {
    const { carts, heard, hear } = aBench();
    const unitOfWork = new InMemoryUnitOfWork();

    hear('shop.cart.opened');

    await unitOfWork.run(async () => {
      await unitOfWork.run(() => carts.save(Cart.open('c1')));
      heard.push('inner run over');
      await carts.save(Cart.open('c2'));
      heard.push('outer work over');
    });

    expect(heard).toEqual(['inner run over', 'outer work over', 'shop.cart.opened', 'shop.cart.opened']);
  });

  it('does not exist outside of a unit of work: the save dispatches at once, both phases', async () => {
    const { carts, dispatcher, heard, hear } = aBench();

    hear('shop.cart.opened');
    dispatcher.on('shop.cart.opened', async () => void heard.push('after'), { phase: 'after-commit' });
    await carts.save(Cart.open('c1'));
    heard.push('save resolved');

    expect(heard).toEqual(['shop.cart.opened', 'after', 'save resolved']);
  });
});
