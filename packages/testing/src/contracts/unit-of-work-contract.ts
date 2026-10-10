import type { Awaitable } from './awaitable.js';
import type { ContractRunner } from './contract-runner.js';
import { AfterCommitSuite } from './unit-of-work/after-commit-suite.js';
import { DispatchSuite } from './unit-of-work/dispatch-suite.js';
import { FailureSuite } from './unit-of-work/failure-suite.js';
import type { UnitOfWorkUnderContract } from './unit-of-work/unit-of-work-under-contract.js';

export interface UnitOfWorkContractOptions {
  readonly name: string;
  /** A unit of work over an empty table and an empty outbox; called before each test. */
  createUnitOfWork(): Awaitable<UnitOfWorkUnderContract>;
}

/**
 * What every `UnitOfWork` guarantees about domain events, whatever it runs on: an effect of a
 * domain event exists only if the state change that recorded it is committed. Events wait for
 * the end of the unit of work and are dispatched before the commit, so their handlers see every
 * save and what they write commits or rolls back with it; a failure in a save, in the work, in
 * a handler or in the commit leaves nothing behind; `after-commit` handlers run once the rows
 * are committed, never otherwise. `run` is called directly, without a command bus: an adapter
 * that does not build on `withinUnitOfWork` fails here.
 */
export function unitOfWorkContract(runner: ContractRunner, options: UnitOfWorkContractOptions): void {
  const create = (): Awaitable<UnitOfWorkUnderContract> => options.createUnitOfWork();

  new DispatchSuite(runner, create).describe(`${options.name} (unit of work contract: dispatch at the end)`);
  new FailureSuite(runner, create).describe(`${options.name} (unit of work contract: nothing survives a failure)`);
  new AfterCommitSuite(runner, create).describe(`${options.name} (unit of work contract: after the commit)`);
}
