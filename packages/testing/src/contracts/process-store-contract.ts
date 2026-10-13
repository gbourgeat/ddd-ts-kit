import type { StoredProcess } from '@ddd-ts-kit/kernel';
import type { Awaitable } from './awaitable.js';
import type { ContractRunner } from './contract-runner.js';
import { ContractSuite } from './contract-suite.js';
import { failureOf } from './failure-of.js';

/** The process store port of the kernel, restated so that a store of any package fits. */
export interface ProcessStoreUnderContract {
  load(name: string, id: string): Promise<StoredProcess | undefined>;
  save(process: StoredProcess): Promise<void>;
}

/** The unit of work the store is used in, as the kernel port states it. */
interface UnitOfWorkOfTheStore {
  run<T>(work: () => Promise<T>): Promise<T>;
}

export interface ProcessStoreContractOptions {
  readonly name: string;
  /** A fresh, empty store; called before each test. */
  createStore(): Awaitable<ProcessStoreUnderContract>;
  /** The unit of work over the same context as the store just created: the contract then proves that a rolled back save leaves nothing. */
  readonly unitOfWork?: () => UnitOfWorkOfTheStore;
}

/**
 * What every `ProcessStore` guarantees: an instance comes back as saved, JSON state, armed
 * timeouts and end included; a save at a version that is not the next one is refused with the
 * code `CONCURRENCY_CONFLICT`, also when two first saves race; and, in a unit of work, a save
 * shares its fate.
 */
export function processStoreContract(runner: ContractRunner, options: ProcessStoreContractOptions): void {
  new ProcessStoreSuite(runner, options).describe(`${options.name} (process store contract)`);
}

const NAME = 'billing.dunning';

class ProcessStoreSuite extends ContractSuite<ProcessStoreUnderContract> {
  constructor(
    runner: ContractRunner,
    private readonly options: ProcessStoreContractOptions,
  ) {
    super(runner, () => options.createStore());
  }

  protected tests(): void {
    this.keeps();
    this.refusesStaleVersions();

    if (this.options.unitOfWork !== undefined) {
      this.sharesTheUnitOfWork(this.options.unitOfWork);
    }
  }

  private keeps(): void {
    this.it('knows no instance before it is saved, and gives one back as saved', async () => {
      this.expect(await this.subject.load(NAME, 'invoice-1')).toBe(undefined);

      await this.subject.save(anInstance(1));

      this.expect(await this.subject.load(NAME, 'invoice-1')).toEqual(anInstance(1));
      this.expect(await this.subject.load('billing.collection', 'invoice-1')).toBe(undefined);
    });

    this.it('keeps the next versions, the end and the timeouts', async () => {
      await this.subject.save(anInstance(1));
      await this.subject.save({ ...anInstance(2), ended: true, timeouts: {} });

      this.expect(await this.subject.load(NAME, 'invoice-1')).toEqual({ ...anInstance(2), ended: true, timeouts: {} });
    });
  }

  private refusesStaleVersions(): void {
    this.it('refuses a version that is not the next one', async () => {
      await this.subject.save(anInstance(1));

      const failures = [
        await failureOf(() => this.subject.save(anInstance(1))),
        await failureOf(() => this.subject.save(anInstance(3))),
      ];

      this.expect(failures.map(codeOf)).toEqual(['CONCURRENCY_CONFLICT', 'CONCURRENCY_CONFLICT']);
      this.expect((await this.subject.load(NAME, 'invoice-1'))?.version).toBe(1);
    });

    this.it('lets one of two first saves of an instance win', async () => {
      const outcomes = await Promise.all([
        failureOf(() => this.subject.save(anInstance(1))),
        failureOf(() => this.subject.save({ ...anInstance(1), state: { stage: 'other' } })),
      ]);

      this.expect(outcomes.filter((failure) => failure === undefined).length).toBe(1);
      this.expect(outcomes.map(codeOf).filter((code) => code !== undefined)).toEqual(['CONCURRENCY_CONFLICT']);
    });
  }

  private sharesTheUnitOfWork(unitOfWork: () => UnitOfWorkOfTheStore): void {
    this.it('leaves nothing behind a unit of work that rolled back', async () => {
      await failureOf(() =>
        unitOfWork().run(async () => {
          await this.subject.save(anInstance(1));
          throw new Error('the step failed');
        }),
      );

      this.expect(await this.subject.load(NAME, 'invoice-1')).toBe(undefined);
    });
  }
}

function anInstance(version: number): StoredProcess {
  return {
    name: NAME,
    id: 'invoice-1',
    state: { stage: 'reminded', reminders: [1, 2], amount: 12.5, note: null },
    version,
    ended: false,
    timeouts: { 'second-reminder': 'job-7' },
  };
}

function codeOf(failure: unknown): unknown {
  return typeof failure === 'object' && failure !== null ? Reflect.get(failure, 'code') : undefined;
}
