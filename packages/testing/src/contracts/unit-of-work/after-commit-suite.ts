import { SaveAfterCommitError } from '@ddd-ts-kit/kernel';
import { ContractSuite } from '../contract-suite';
import { Parcel } from './parcel';
import { ShippingBench } from './shipping-bench';
import type { UnitOfWorkUnderContract } from './unit-of-work-under-contract';

class CacheDown extends Error {}

/** The `after-commit` phase: after the commit, never without it, and never in the way of the caller. */
export class AfterCommitSuite extends ContractSuite<UnitOfWorkUnderContract> {
  protected tests(): void {
    this.afterEach(async () => {
      await this.subject.close?.();
    });

    this.runsOnceCommitted();
    this.isolatesFailures();
    this.refusesToSave();
  }

  private runsOnceCommitted(): void {
    this.it(
      'runs the after-commit handlers once the rows are committed, visible from outside the transaction',
      async () => {
        const bench = new ShippingBench(this.subject);
        const isolated = this.subject.committedIds !== undefined;

        bench.on('before-commit', async (event) => {
          if (isolated) {
            bench.journal.push(`before ${event.aggregateId}: outside sees ${await this.seenFromOutside()}`);
          }
        });

        bench.on('after-commit', async (event) => {
          bench.journal.push(`after ${event.aggregateId}: outside sees ${await this.seenFromOutside()}`);
        });

        this.expect(await bench.run(async () => (await bench.parcels.save(Parcel.register('p1')), 'answer'))).toBe(
          'answer',
        );

        const before = isolated ? ['before p1: outside sees nothing'] : [];

        this.expect(bench.journal).toEqual([...before, 'after p1: outside sees p1']);
      },
    );
  }

  /** What another connection sees where the subject has one; what the unit of work sees otherwise. */
  private async seenFromOutside(): Promise<string> {
    const ids = await (this.subject.committedIds?.() ?? this.subject.ids());

    return ids.length === 0 ? 'nothing' : ids.join(',');
  }

  private isolatesFailures(): void {
    this.it('reports the after-commit handler that fails, runs the others and answers the caller', async () => {
      const bench = new ShippingBench(this.subject);
      const failure = new CacheDown();

      bench.on('after-commit', async (event) => {
        if (event.aggregateId === 'p1') {
          throw failure;
        }
      });

      bench.note('after-commit', 'committed');

      this.expect(await bench.run(async () => (await bench.register('p1', 'p2'), 'answer'))).toBe('answer');

      this.expect(bench.journal).toEqual(['saved p1', 'saved p2', 'committed p1', 'committed p2']);
      this.expect(await this.subject.ids()).toEqual(['p1', 'p2']);

      this.expect(bench.reporter.reports.map(({ error, report }) => [error === failure, report.operation])).toEqual([
        [true, `after-commit ${Parcel.REGISTERED}`],
      ]);

      this.expect(
        bench.logger.entries.map(({ level, fields }) => [level, fields['domainEvent'], fields['errorType']]),
      ).toEqual([['error', Parcel.REGISTERED, 'CacheDown']]);
    });
  }

  private refusesToSave(): void {
    this.it(
      'refuses the save of an after-commit handler before it writes, and runs the unit of work it opens apart',
      async () => {
        const bench = new ShippingBench(this.subject);

        bench.on('after-commit', async (event) => {
          if (event.aggregateId === 'p1') {
            await bench.parcels.save(Parcel.register('p2'));
          }
        });

        bench.on('after-commit', async (event) => {
          if (event.aggregateId === 'p1') {
            await bench.run(() => bench.register('p3'));
          }
        });

        bench.note('before-commit', 'handling');
        await bench.run(() => bench.register('p1'));

        this.expect(bench.reporter.reports.map(({ error }) => error instanceof SaveAfterCommitError)).toEqual([true]);
        this.expect(bench.journal).toEqual(['saved p1', 'handling p1', 'saved p3', 'handling p3']);
        this.expect(await this.subject.ids()).toEqual(['p1', 'p3']);
      },
    );
  }
}
