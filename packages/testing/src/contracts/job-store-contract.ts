import type { Awaitable } from './awaitable.js';
import type { ContractRunner } from './contract-runner.js';
import { ClaimSuite } from './job-store/claim-suite.js';
import type { JobStoreUnderContract } from './job-store/job-store-under-contract.js';
import { KeepSuite } from './job-store/keep-suite.js';
import { ReportSuite } from './job-store/report-suite.js';
import { TransactionSuite, type UnitOfWorkOfTheStore } from './job-store/transaction-suite.js';

export interface JobStoreContractOptions {
  readonly name: string;
  /** A fresh, empty store; called before each test. */
  createStore(): Awaitable<JobStoreUnderContract>;
  /**
   * The unit of work the store is used in, over the same database and the same context as the
   * store just created: the contract then proves that a job added inside it exists if and only
   * if it committed.
   */
  readonly unitOfWork?: () => UnitOfWorkOfTheStore;
}

/**
 * What every `JobStore` guarantees, whatever it runs on: due jobs handed out earliest first and
 * each to one claim, a lease that brings back the job of a worker that died, reports heard only
 * from the attempt that holds the job, retries, dead jobs and their revival, cancellation,
 * idempotency keys, housekeeping, and the enqueue sharing the fate of the unit of work.
 * The claims of the contract ask for a lease of `30000` milliseconds.
 */
export function jobStoreContract(runner: ContractRunner, options: JobStoreContractOptions): void {
  const create = (): Awaitable<JobStoreUnderContract> => options.createStore();

  new ClaimSuite(runner, create).describe(`${options.name} (job store contract: claims)`);
  new ReportSuite(runner, create).describe(`${options.name} (job store contract: reports of an attempt)`);
  new KeepSuite(runner, create).describe(`${options.name} (job store contract: cancellation and housekeeping)`);

  const { unitOfWork } = options;

  if (unitOfWork !== undefined) {
    new TransactionSuite(runner, async () => ({ store: await create(), unitOfWork: unitOfWork() })).describe(
      `${options.name} (job store contract: in a unit of work)`,
    );
  }
}
