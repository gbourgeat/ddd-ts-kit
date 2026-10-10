import { AsyncLocalStorage } from 'node:async_hooks';
import { Command, InMemoryCommandBus, unitOfWorkMiddleware } from '@ddd-ts-kit/kernel';
import { ContractSuite } from '../contract-suite.js';
import { Parcel } from './parcel.js';
import { ShippingBench } from './shipping-bench.js';
import type { UnitOfWorkUnderContract } from './unit-of-work-under-contract.js';

class RegisterParcels extends Command<undefined> {
  constructor(readonly ids: readonly string[]) {
    super();
  }
}

/** When the domain events of a unit of work reach their handlers. */
export class DispatchSuite extends ContractSuite<UnitOfWorkUnderContract> {
  protected tests(): void {
    this.afterEach(async () => {
      await this.subject.close?.();
    });

    this.dispatchesAtTheEnd();
    this.queuesWhatHandlersRecord();
    this.joinsANestedRun();
    this.keepsParallelUnitsApart();
    this.servesTheCommandBus();
    this.dispatchesAtOnceOutside();
  }

  private dispatchesAtTheEnd(): void {
    this.it('dispatches nothing before the work returned: every handler sees every save', async () => {
      const bench = new ShippingBench(this.subject);

      bench.on('before-commit', async (event) => {
        bench.journal.push(`${event.aggregateId} sees ${(await this.subject.ids()).join(',')}`);
      });

      await bench.run(() => bench.register('p1', 'p2'));

      this.expect(bench.journal).toEqual(['saved p1', 'saved p2', 'p1 sees p1,p2', 'p2 sees p1,p2']);
    });

    this.it('dispatches in the order of recording across the saves', async () => {
      const bench = new ShippingBench(this.subject);

      const note = async (event: { name: string; aggregateId: string }) =>
        void bench.journal.push(`${event.name} ${event.aggregateId}`);

      bench.on('before-commit', note);
      bench.on('before-commit', note, Parcel.WEIGHED);

      await bench.run(async () => {
        await bench.parcels.save(Parcel.register('p1').weigh());
        await bench.parcels.save(Parcel.register('p2'));
      });

      this.expect(bench.journal).toEqual([
        `${Parcel.REGISTERED} p1`,
        `${Parcel.WEIGHED} p1`,
        `${Parcel.REGISTERED} p2`,
      ]);
    });
  }

  private queuesWhatHandlersRecord(): void {
    this.it(
      'dispatches what a handler saved after the events already waiting, once, in the same transaction',
      async () => {
        const bench = new ShippingBench(this.subject);

        bench.on('before-commit', async (event) => {
          bench.journal.push(`handling ${event.aggregateId}`);

          if (event.aggregateId === 'p1') {
            await bench.register('p3');
          }
        });

        await bench.run(() => bench.register('p1', 'p2'));

        this.expect(bench.journal).toEqual([
          'saved p1',
          'saved p2',
          'handling p1',
          'saved p3',
          'handling p2',
          'handling p3',
        ]);

        this.expect(await this.subject.ids()).toEqual(['p1', 'p2', 'p3']);
      },
    );
  }

  private joinsANestedRun(): void {
    this.it(
      'joins the unit of work in progress on a nested run: one dispatch, at the end of the outermost',
      async () => {
        const bench = new ShippingBench(this.subject);

        bench.note('before-commit', 'handling');
        bench.note('after-commit', 'committed');

        await bench.run(async () => {
          await bench.run(() => bench.register('p1'));
          bench.journal.push('inner run over');
          await bench.register('p2');
        });

        this.expect(bench.journal).toEqual([
          'saved p1',
          'inner run over',
          'saved p2',
          'handling p1',
          'handling p2',
          'committed p1',
          'committed p2',
        ]);
      },
    );
  }

  private keepsParallelUnitsApart(): void {
    this.it('keeps two units of work running side by side apart: each dispatches its own events', async () => {
      const bench = new ShippingBench(this.subject);
      const lane = new AsyncLocalStorage<string>();

      bench.on(
        'before-commit',
        async (event) => void bench.journal.push(`${lane.getStore() ?? 'none'} dispatches ${event.aggregateId}`),
      );

      const slowThenFast = (name: string, ms: number) => async (): Promise<void> => {
        await bench.parcels.save(Parcel.register(`${name}1`));
        await pause(ms);
        await bench.parcels.save(Parcel.register(`${name}2`));
        await pause(ms);
      };

      await Promise.all([
        lane.run('a', () => bench.run(slowThenFast('a', 12))),
        lane.run('b', () => bench.run(slowThenFast('b', 3))),
      ]);

      this.expect([...bench.journal].sort()).toEqual([
        'a dispatches a1',
        'a dispatches a2',
        'b dispatches b1',
        'b dispatches b2',
      ]);
    });
  }

  private servesTheCommandBus(): void {
    this.it(
      'dispatches once the command handler returned, and queues behind them what a command sent by a handler saved',
      async () => {
        const bench = new ShippingBench(this.subject);
        const bus = this.registeringBus(bench);

        bench.on('before-commit', async (event) => {
          bench.journal.push(`handling ${event.aggregateId}`);

          if (event.aggregateId === 'p1') {
            await bus.execute(new RegisterParcels(['p3']));
          }
        });

        await bus.execute(new RegisterParcels(['p1', 'p2']));

        this.expect(bench.journal).toEqual([
          'saved p1',
          'saved p2',
          'handler over',
          'handling p1',
          'saved p3',
          'handler over',
          'handling p2',
          'handling p3',
        ]);
      },
    );
  }

  private registeringBus(bench: ShippingBench): InMemoryCommandBus {
    const bus = new InMemoryCommandBus().use(unitOfWorkMiddleware(this.subject.unitOfWork));

    bus.register(RegisterParcels, {
      execute: async ({ ids }) => {
        await bench.register(...ids);
        bench.journal.push('handler over');

        return undefined;
      },
    });

    return bus;
  }

  private dispatchesAtOnceOutside(): void {
    this.it('dispatches with the save outside of any unit of work: both phases, before the save resolves', async () => {
      const bench = new ShippingBench(this.subject);

      bench.note('before-commit', 'handling');
      bench.note('after-commit', 'committed');

      await bench.register('p1');
      await bench.register('p2');

      this.expect(bench.journal).toEqual([
        'handling p1',
        'committed p1',
        'saved p1',
        'handling p2',
        'committed p2',
        'saved p2',
      ]);
    });
  }
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
