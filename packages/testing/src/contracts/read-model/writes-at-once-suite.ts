import type { ReadModelRows } from '@ddd-ts-kit/kernel';
import type { Awaitable } from '../awaitable';
import type { ContractRunner } from '../contract-runner';
import type { CriteriaContractRow } from '../criteria/criteria-contract-row';
import { ReadModelStoreSuite } from './read-model-store-suite';
import type { ReadModelRowsUnderContract } from './read-model-rows-under-contract';
import type { ReadModelStorageUnderContract } from './read-model-storage-under-contract';
import { rowOf as row } from './row-of';
import { stampedAt as at } from './stamped-at';

type Row = CriteriaContractRow;

/** Enough rounds for a storage that refuses one writer in ten to fail the case all but once in a hundred runs. */
const ROUNDS = 40;

const WRITERS = [1, 2, 3, 4, 5];

/** What the writers of one round are answered, in one order: one of them wrote the row, the others found the key held. */
const ONE_WRITER = ['held', 'held', 'held', 'held', 'inserted'];

export interface WritesAtOnce extends ReadModelStorageUnderContract {
  /** Whether the table has a rebuild, whose copy takes the same writes. */
  readonly rebuilt: boolean;
}

/**
 * Inserts made at once on a storage that holds another value of the row unique. The writers of
 * one key all write that value: one of them takes the row, the others are told the key is held
 * and none is refused for the value, in the table and in the copy of a rebuild. Writers of
 * several keys that take one value are another matter: one row holds it and the others are refused.
 */
export class WritesAtOnceSuite extends ReadModelStoreSuite {
  constructor(
    runner: ContractRunner,
    create: () => Awaitable<ReadModelRowsUnderContract>,
    private readonly storage: WritesAtOnce,
  ) {
    super(runner, create);
  }

  protected tests(): void {
    this.closesAfterEach();

    if (this.storage.uniqueTitle !== true) {
      this.todo(
        'takes once a row several writers insert at once, and refuses a unique value taken at once by several rows (hold title unique, and say uniqueTitle)',
      );

      return;
    }

    this.takesOnceTheRowOfOneKey();
    this.refusesTheValueOfAnotherRow();
  }

  private takesOnceTheRowOfOneKey(): void {
    this.it('takes once a row several writers insert at once, and refuses none for its unique value', async () => {
      this.expect(await roundsOn(this.subject.table)).toEqual(new Array(ROUNDS).fill(ONE_WRITER));
    });

    if (!this.storage.rebuilt) {
      return;
    }

    this.it('takes once a row several writers insert at once in the copy of a rebuild', async () => {
      const { table } = this.subject;

      await table.beginRebuild();

      this.expect(await roundsOn(table.shadow())).toEqual(new Array(ROUNDS).fill(ONE_WRITER));

      await table.abandonRebuild();
    });
  }

  private refusesTheValueOfAnotherRow(): void {
    this.it('lets one of several rows take a unique value at once, and refuses the others', async () => {
      const { table } = this.subject;

      const answers = await answersOf(
        WRITERS.map((writer) => {
          const key = `w${String(writer)}`;

          return table.insert({ key, row: { ...row('a1'), id: key }, stamp: at('evt-1', 1) });
        }),
      );

      this.expect(answers.map((answer) => (answer.startsWith('refused') ? 'refused' : answer))).toEqual([
        'inserted',
        'refused',
        'refused',
        'refused',
        'refused',
      ]);

      this.expect((await this.ids()).length).toBe(1);
    });
  }
}

/** Rounds of writers inserting at once the row of a key of the round, with a value of its own that the storage holds unique. */
async function roundsOn(rows: ReadModelRows<Row>): Promise<string[][]> {
  const rounds: string[][] = [];

  for (let round = 0; round < ROUNDS; round += 1) {
    const key = `r${String(round)}`;
    const written = { ...row('a1'), id: key, title: `the title of ${key}` };

    rounds.push(
      await answersOf(WRITERS.map((writer) => rows.insert({ key, row: written, stamp: at('evt-1', writer) }))),
    );
  }

  return rounds;
}

/** What each write answered, in one order whichever write came first: a refusal reads with its reason. */
async function answersOf(writes: readonly Promise<boolean>[]): Promise<string[]> {
  const settled = await Promise.allSettled(writes);

  return settled
    .map((write) => {
      if (write.status === 'rejected') {
        return `refused: ${String(write.reason)}`;
      }

      return write.value ? 'inserted' : 'held';
    })
    .sort((left, right) => left.localeCompare(right));
}
