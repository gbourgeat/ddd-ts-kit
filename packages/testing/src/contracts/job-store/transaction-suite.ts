import { ContractSuite } from '../contract-suite.js';
import { failureOf } from '../failure-of.js';
import { aJob } from './a-job.js';
import { LEASE_MS, NOW, QUEUE } from './job-fixtures.js';
import type { JobStoreUnderContract } from './job-store-under-contract.js';

/** The unit of work the store is used in, as the kernel port states it. */
export interface UnitOfWorkOfTheStore {
  run<T>(work: () => Promise<T>): Promise<T>;
}

interface StoreInUnitOfWork {
  readonly store: JobStoreUnderContract;
  readonly unitOfWork: UnitOfWorkOfTheStore;
}

class CommandRefused extends Error {}

/**
 * A job added inside a unit of work exists if and only if the unit of work committed; a job
 * cancelled or revived inside one is cancelled or revived if and only if it committed.
 */
export class TransactionSuite extends ContractSuite<StoreInUnitOfWork> {
  protected tests(): void {
    this.adds();
    this.cancels();
    this.revives();
  }

  private adds(): void {
    this.it('leaves no job behind a unit of work that rolled back', async () => {
      const failure = await failureOf(() =>
        this.subject.unitOfWork.run(async () => {
          await this.subject.store.add(aJob('job-1'));
          throw new CommandRefused();
        }),
      );

      this.expect(failure instanceof CommandRefused).toBe(true);
      this.expect(await this.subject.store.find('job-1')).toBe(undefined);
      this.expect(await this.claimed()).toEqual([]);
    });

    this.it('keeps the job of a unit of work that committed', async () => {
      await this.subject.unitOfWork.run(() => this.subject.store.add(aJob('job-1')));

      this.expect(await this.claimed()).toEqual(['job-1']);
    });
  }

  private cancels(): void {
    this.it('leaves the job waiting when the unit of work that cancelled it rolled back', async () => {
      await this.subject.store.add(aJob('job-1'));

      await failureOf(() =>
        this.subject.unitOfWork.run(async () => {
          this.expect(await this.subject.store.cancel('job-1', NOW)).toBe(true);
          throw new CommandRefused();
        }),
      );

      this.expect((await this.subject.store.find('job-1'))?.status).toBe('waiting');
      this.expect(await this.claimed()).toEqual(['job-1']);
    });

    this.it('cancels the job once the unit of work committed', async () => {
      await this.subject.store.add(aJob('job-1'));

      const cancelled = await this.subject.unitOfWork.run(() => this.subject.store.cancel('job-1', NOW));

      this.expect([cancelled, (await this.subject.store.find('job-1'))?.status]).toEqual([true, 'cancelled']);
      this.expect(await this.claimed()).toEqual([]);
    });
  }

  private revives(): void {
    this.it('leaves the job dead when the unit of work that revived it rolled back', async () => {
      await this.subject.store.add(aJob('job-1'));
      await this.claimed();
      await this.subject.store.fail({ id: 'job-1', attempt: 1 }, { errorCode: 'X', retryAt: null, at: NOW });

      await failureOf(() =>
        this.subject.unitOfWork.run(async () => {
          this.expect(await this.subject.store.retryDead(['job-1'], NOW)).toBe(1);
          throw new CommandRefused();
        }),
      );

      this.expect((await this.subject.store.find('job-1'))?.status).toBe('dead');
      this.expect(await this.subject.unitOfWork.run(() => this.subject.store.retryDead(['job-1'], NOW))).toBe(1);
      this.expect((await this.subject.store.find('job-1'))?.status).toBe('waiting');
    });
  }

  private async claimed(): Promise<string[]> {
    const jobs = await this.subject.store.claim({ queue: QUEUE, limit: 10, now: NOW, leaseMs: LEASE_MS });

    return jobs.map((job) => job.id);
  }
}
