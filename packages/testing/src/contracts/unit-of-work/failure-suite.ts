import { ContractSuite } from '../contract-suite';
import { failureOf } from '../failure-of';
import { Parcel } from './parcel';
import { ShippingBench } from './shipping-bench';
import type { UnitOfWorkUnderContract } from './unit-of-work-under-contract';

class CarrierDown extends Error {}

/**
 * No effect of a domain event survives a persistence failure, wherever the failure happens:
 * in the save, in a later save, in the work, in a handler or in the commit itself.
 */
export class FailureSuite extends ContractSuite<UnitOfWorkUnderContract> {
  protected tests(): void {
    this.afterEach(async () => {
      await this.subject.close?.();
    });

    this.refusedSave();
    this.failingWork();
    this.failingHandler();
    this.failingCommit();
    this.relaysWhatCommitted();
  }

  private refusedSave(): void {
    this.it(
      'hands no event over for a save the database refused, in a unit of work or outside: they stay on the aggregate',
      async () => {
        const bench = this.everyEffect();
        const inside = Parcel.register('p1');
        const outside = Parcel.register('p1');

        await this.subject.insert('p1');

        this.expect((await failureOf(() => bench.run(() => bench.parcels.save(inside)))) === undefined).toBe(false);
        this.expect((await failureOf(() => bench.parcels.save(outside))) === undefined).toBe(false);
        this.expect(bench.journal).toEqual([]);
        this.expect([inside.pullEvents().length, outside.pullEvents().length]).toEqual([1, 1]);
        this.expect(await bench.pending()).toBe(0);
      },
    );

    this.it(
      'runs no handler of the earlier saves when a later save is refused: nothing stored, nothing in the outbox',
      async () => {
        const bench = this.everyEffect();

        const failure = await failureOf(() => bench.run(() => bench.register('p1', 'p2', 'p1')));

        this.expect(failure === undefined).toBe(false);
        await this.expectNothingLeft(bench, ['saved p1', 'saved p2']);
      },
    );
  }

  private everyEffect(): ShippingBench {
    const bench = new ShippingBench(this.subject);

    bench.publish();
    bench.note('after-commit', 'committed');

    return bench;
  }

  private async expectNothingLeft(bench: ShippingBench, journal: readonly string[]): Promise<void> {
    this.expect(bench.journal).toEqual(journal);
    this.expect(await this.subject.ids()).toEqual([]);
    this.expect(await bench.pending()).toBe(0);
    this.expect(await bench.relayed()).toEqual([]);
  }

  private failingWork(): void {
    this.it('runs no handler when the work fails after a save: nothing stored, nothing in the outbox', async () => {
      const bench = this.everyEffect();

      const failure = await failureOf(() =>
        bench.run(async () => {
          await bench.register('p1');
          throw new CarrierDown();
        }),
      );

      this.expect(failure instanceof CarrierDown).toBe(true);
      await this.expectNothingLeft(bench, ['saved p1']);
    });

    this.it('drops the events of a rolled back unit of work: the retry dispatches what it records, once', async () => {
      const bench = this.everyEffect();
      const first = Parcel.register('p1');

      await failureOf(() =>
        bench.run(async () => {
          await bench.parcels.save(first);
          throw new CarrierDown();
        }),
      );

      this.expect(first.pullEvents()).toEqual([]);

      await bench.run(() => bench.register('p1'));

      this.expect(bench.journal).toEqual(['saved p1', 'published p1', 'committed p1']);
      this.expect(await bench.relayed()).toEqual(['evt-p1']);
    });
  }

  private failingHandler(): void {
    this.it(
      'fails the unit of work when a before-commit handler fails: state and outbox rolled back, no after-commit handler',
      async () => {
        const bench = this.everyEffect();

        bench.on('before-commit', async (event) => {
          if (event.aggregateId === 'p2') {
            throw new CarrierDown();
          }
        });

        const failure = await failureOf(() => bench.run(() => bench.register('p1', 'p2')));

        this.expect(failure instanceof CarrierDown).toBe(true);
        await this.expectNothingLeft(bench, ['saved p1', 'saved p2', 'published p1', 'published p2']);
      },
    );
  }

  private failingCommit(): void {
    this.it(
      'rolls back what the before-commit handlers wrote when the commit itself fails, and runs no after-commit handler',
      async () => {
        const bench = this.everyEffect();

        const failure = await failureOf(() =>
          bench.run(async () => {
            await bench.register('p1');
            await this.subject.insertRefusedAtCommit('p2');
          }),
        );

        this.expect(failure === undefined).toBe(false);
        await this.expectNothingLeft(bench, ['saved p1', 'published p1']);
      },
    );
  }

  private relaysWhatCommitted(): void {
    this.it(
      'leaves in the outbox what the committed unit of work published for each save, and nothing of the one rolled back',
      async () => {
        const bench = this.everyEffect();

        await bench.run(() => bench.register('p1', 'p2'));

        await failureOf(() =>
          bench.run(async () => {
            await bench.register('p3');
            throw new CarrierDown();
          }),
        );

        this.expect(await this.subject.ids()).toEqual(['p1', 'p2']);
        this.expect(await bench.pending()).toBe(2);
        this.expect(await bench.relayed()).toEqual(['evt-p1', 'evt-p2']);
      },
    );
  }
}
