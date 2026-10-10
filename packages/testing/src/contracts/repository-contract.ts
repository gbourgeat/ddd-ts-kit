import { CONCURRENCY_CONFLICT } from '@ddd-ts-kit/kernel';
import type { AggregateRoot, Repository } from '@ddd-ts-kit/kernel';
import type { Awaitable } from './awaitable.js';
import type { ContractRunner } from './contract-runner.js';
import { ContractSuite } from './contract-suite.js';
import { failureOf } from './failure-of.js';

export interface RepositoryContractOptions<A extends AggregateRoot<Id>, Id extends string | number> {
  readonly name: string;
  /** A fresh, empty repository; called before each test. */
  createRepository(): Awaitable<Repository<A, Id>>;
  /** A new valid aggregate with an id of its own at each call. */
  createAggregate(): A;
  /** Any business operation that changes what `stateOf` returns. */
  mutate(aggregate: A): void;
  idOf(aggregate: A): Id;
  /** A plain-data view of the business state (not of `version`), compared with `toEqual`. */
  stateOf(aggregate: A): unknown;
}

/** What every adapter of a `Repository` port, fake or real, guarantees to the application layer. */
export function repositoryContract<A extends AggregateRoot<Id>, Id extends string | number = string>(
  runner: ContractRunner,
  options: RepositoryContractOptions<A, Id>,
): void {
  new RepositorySuite(runner, options).describe(`${options.name} (repository contract)`);
}

class RepositorySuite<
  A extends AggregateRoot<Id>,
  Id extends string | number,
> extends ContractSuite<Repository<A, Id>> {
  constructor(
    runner: ContractRunner,
    private readonly options: RepositoryContractOptions<A, Id>,
  ) {
    super(runner, () => options.createRepository());
  }

  protected tests(): void {
    this.findsWhatWasSaved();
    this.keepsAggregatesApart();
    this.storesTheChangesOfLaterSaves();
    this.ignoresWhatWasNotSaved();
    this.refusesToOverwriteAnUnseenChange();
  }

  private findsWhatWasSaved(): void {
    const { options } = this;

    this.it('finds a saved aggregate with the state it was saved in', async () => {
      const aggregate = options.createAggregate();

      await this.subject.save(aggregate);

      const found = await this.reload(aggregate);

      this.expect(options.idOf(found)).toBe(options.idOf(aggregate));
      this.expect(options.stateOf(found)).toEqual(options.stateOf(aggregate));
    });

    this.it('gives undefined for an id that was never saved', async () => {
      await this.subject.save(options.createAggregate());

      const unknownId = options.idOf(options.createAggregate());

      this.expect(await this.subject.findById(unknownId)).toBe(undefined);
    });
  }

  private keepsAggregatesApart(): void {
    const { options } = this;

    this.it('keeps aggregates apart', async () => {
      const first = options.createAggregate();
      const second = options.createAggregate();

      options.mutate(second);
      await this.subject.save(first);
      await this.subject.save(second);

      this.expect(options.stateOf(await this.reload(first))).toEqual(options.stateOf(first));
      this.expect(options.stateOf(await this.reload(second))).toEqual(options.stateOf(second));
    });
  }

  private storesTheChangesOfLaterSaves(): void {
    const { options } = this;

    this.it('stores the changes of a loaded aggregate that is saved again', async () => {
      const aggregate = options.createAggregate();

      await this.subject.save(aggregate);

      const loaded = await this.reload(aggregate);

      options.mutate(loaded);
      await this.subject.save(loaded);

      this.expect(options.stateOf(await this.reload(aggregate))).toEqual(options.stateOf(loaded));
    });

    this.it('accepts several saves of the same instance in a row', async () => {
      const aggregate = options.createAggregate();

      await this.subject.save(aggregate);
      options.mutate(aggregate);
      await this.subject.save(aggregate);

      this.expect(options.stateOf(await this.reload(aggregate))).toEqual(options.stateOf(aggregate));
    });
  }

  private ignoresWhatWasNotSaved(): void {
    const { options } = this;

    this.it('is not affected by a mutation that is not saved', async () => {
      const aggregate = options.createAggregate();
      // Copied: `stateOf` may hand out a live view of the aggregate about to be mutated.
      const saved = structuredClone(options.stateOf(aggregate));

      await this.subject.save(aggregate);

      options.mutate(aggregate);
      options.mutate(await this.reload(aggregate));

      this.expect(options.stateOf(await this.reload(aggregate))).toEqual(saved);
    });
  }

  private refusesToOverwriteAnUnseenChange(): void {
    const { options } = this;

    this.it('refuses to overwrite a change it has not seen', async () => {
      const aggregate = options.createAggregate();

      await this.subject.save(aggregate);
      const mine = await this.reload(aggregate);
      const theirs = await this.reload(aggregate);

      options.mutate(theirs);
      await this.subject.save(theirs);
      const failure = await failureOf(() => this.subject.save(mine));

      this.expect(codeOf(failure)).toBe(CONCURRENCY_CONFLICT);
      this.expect(options.stateOf(await this.reload(aggregate))).toEqual(options.stateOf(theirs));
    });
  }

  private async reload(aggregate: A): Promise<A> {
    const found = await this.subject.findById(this.options.idOf(aggregate));

    if (found === undefined) {
      throw new Error('The saved aggregate was not found');
    }

    return found;
  }
}

function codeOf(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
}
