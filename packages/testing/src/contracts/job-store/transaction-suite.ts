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

/** A job added inside a unit of work exists if and only if the unit of work committed. */
export class TransactionSuite extends ContractSuite<StoreInUnitOfWork> {
  protected tests(): void {
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

  private async claimed(): Promise<string[]> {
    const jobs = await this.subject.store.claim({ queue: QUEUE, limit: 10, now: NOW, leaseMs: LEASE_MS });

    return jobs.map((job) => job.id);
  }
}
