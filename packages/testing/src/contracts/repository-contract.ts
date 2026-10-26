import { isDeepStrictEqual } from 'node:util';
import { CONCURRENCY_CONFLICT } from '@ddd-ts-kit/kernel';
import type { AggregateRoot, Repository } from '@ddd-ts-kit/kernel';
import type { Awaitable } from './awaitable';
import type { ContractRunner } from './contract-runner';
import { ContractSuite } from './contract-suite';
import { failureOf } from './failure-of';

export interface RepositoryContractOptions<A extends AggregateRoot<Id>, Id extends string | number> {
  readonly name: string;
  /** A fresh, empty repository; called before each test. */
  createRepository(): Awaitable<Repository<A, Id>>;
  /** A new valid aggregate with an id of its own at each call. */
  createAggregate(): A;
  /**
   * Any business operation that changes what `stateOf` returns, and records a change (an event, for an
   * event-sourced aggregate): a save of an aggregate with no pending change is a no-op for concurrency.
   * Optional: without it, the case of the stale save stays pending until the contract is given one.
   */
  mutate?(aggregate: A): void;
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

class RepositorySuite<A extends AggregateRoot<Id>, Id extends string | number> extends ContractSuite<
  Repository<A, Id>
> {
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

      options.mutate?.(second);
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

      options.mutate?.(loaded);
      await this.subject.save(loaded);

      this.expect(options.stateOf(await this.reload(aggregate))).toEqual(options.stateOf(loaded));
    });

    this.it('accepts several saves of the same instance in a row', async () => {
      const aggregate = options.createAggregate();

      await this.subject.save(aggregate);
      options.mutate?.(aggregate);
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

      options.mutate?.(aggregate);
      options.mutate?.(await this.reload(aggregate));

      this.expect(options.stateOf(await this.reload(aggregate))).toEqual(saved);
    });
  }

  private refusesToOverwriteAnUnseenChange(): void {
    const { options } = this;

    if (options.mutate === undefined) {
      this.todo(
        'refuses to overwrite a change it has not seen (give the contract a mutate that records a change of state)',
      );

      return;
    }

    this.it('refuses to overwrite a change it has not seen', async () => {
      const aggregate = options.createAggregate();

      await this.subject.save(aggregate);
      const mine = await this.reload(aggregate);
      const theirs = await this.reload(aggregate);

      // Copied: `stateOf` may hand out a live view of the aggregate about to be mutated.
      const before = structuredClone(options.stateOf(theirs));

      options.mutate?.(theirs);

      if (isDeepStrictEqual(before, options.stateOf(theirs))) {
        throw new Error('mutate changed nothing: give the contract a change of state');
      }

      await this.subject.save(theirs);
      // A save with no pending change refuses nothing, so the stale copy has a change of its own to save.
      options.mutate?.(mine);
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
