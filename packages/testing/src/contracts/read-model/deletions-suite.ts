import type { ContractRunner } from '../contract-runner';
import type { Awaitable } from '../awaitable';
import { ReadModelStoreSuite } from './read-model-store-suite';
import type { ReadModelRowsUnderContract } from './read-model-rows-under-contract';
import type { ReadModelStorageUnderContract } from './read-model-storage-under-contract';
import { rowOf as row } from './row-of';
import { stampedAt as at } from './stamped-at';

/** Every field of the row but its key, as a deleted row holds it. */
const NO_DATA = Object.fromEntries(
  Object.keys(row('a1'))
    .filter((field) => field !== 'id')
    .map((field) => [field, null]),
);

/**
 * Deletions that last whatever the order of the deliveries: of a row the table holds, and of a
 * key it does not hold yet, whose trace stops the older creation delivered after it. A deleted
 * row keeps its key and its stamp, and none of its data.
 */
export class DeletionsSuite extends ReadModelStoreSuite {
  constructor(
    runner: ContractRunner,
    create: () => Awaitable<ReadModelRowsUnderContract>,
    private readonly storage: ReadModelStorageUnderContract,
  ) {
    super(runner, create);
  }

  protected tests(): void {
    this.closesAfterEach();
    this.deletesARowItHolds();
    this.deletesAKeyItDoesNotHold();
    this.deletesWhileTheCreationArrives();
    this.keepsNoData();
    this.freesAUniqueValue();
  }

  private deletesARowItHolds(): void {
    this.it('removes a row, and an older event delivered late does not bring it back', async () => {
      await this.put(row('a1'), at('evt-1', 1));

      this.expect(await this.store.delete('a1', at('evt-3', 3))).toBe('applied');
      this.expect(await this.store.get('a1')).toBe(undefined);
      this.expect(await this.put(row('a1'), at('evt-2', 2))).toBe('stale');
      this.expect(await this.store.get('a1')).toBe(undefined);
    });

    this.it('writes a row again when a later event recreates it', async () => {
      await this.put(row('a1'), at('evt-1', 1));
      await this.store.delete('a1', at('evt-2', 2));

      this.expect(await this.put({ ...row('a1'), title: 'back' }, at('evt-3', 3))).toBe('applied');
      this.expect((await this.store.get('a1'))?.title).toBe('back');
    });

    this.it('ignores a deletion older than the row', async () => {
      await this.put(row('a1'), at('evt-2', 2));

      this.expect(await this.store.delete('a1', at('evt-1', 1))).toBe('stale');
      this.expect(await this.store.get('a1')).toEqual(row('a1'));
    });
  }

  private deletesAKeyItDoesNotHold(): void {
    this.it('inserts the trace of a deleted row under a key it does not hold, once', async () => {
      const { table } = this.subject;

      this.expect(await table.insert({ key: 'a1', row: undefined, stamp: at('evt-1', 1) })).toBe(true);
      this.expect(await table.insert({ key: 'a1', row: undefined, stamp: at('evt-2', 2) })).toBe(false);
      this.expect(await table.find('a1')).toEqual({ key: 'a1', row: undefined, stamp: at('evt-1', 1) });
      this.expect(await this.ids()).toEqual([]);
    });

    this.it('applies a deletion delivered before the creation it follows, which is then stale', async () => {
      this.expect(await this.store.delete('a1', at('evt-3', 3))).toBe('applied');
      this.expect(await this.put(row('a1'), at('evt-2', 2))).toBe('stale');
      this.expect(await this.store.get('a1')).toBe(undefined);
      this.expect(await this.ids()).toEqual([]);
    });

    this.it('writes the row of a later event over the trace of a key it never held', async () => {
      await this.store.delete('a1', at('evt-3', 3));

      this.expect(await this.put(row('a1'), at('evt-4', 4))).toBe('applied');
      this.expect(await this.store.get('a1')).toEqual(row('a1'));
    });
  }

  private deletesWhileTheCreationArrives(): void {
    this.it('ends deleted when a deletion and the older creation arrive at once', async () => {
      await Promise.all([this.store.delete('a1', at('evt-3', 3)), this.put(row('a1'), at('evt-2', 2))]);

      this.expect(await this.subject.table.find('a1')).toEqual({ key: 'a1', row: undefined, stamp: at('evt-3', 3) });
    });

    this.it('ends on the row when a deletion and a newer creation arrive at once', async () => {
      await Promise.all([this.store.delete('a1', at('evt-2', 2)), this.put(row('a1'), at('evt-3', 3))]);

      this.expect(await this.subject.table.find('a1')).toEqual({ key: 'a1', row: row('a1'), stamp: at('evt-3', 3) });
    });
  }

  private keepsNoData(): void {
    const { stored } = this.storage;

    if (stored === undefined) {
      this.todo('keeps no data of a deleted row (give the contract a stored that reads the storage beside the store)');

      return;
    }

    this.it('keeps no data of a deleted row, whether it held the row or not', async () => {
      await this.put(row('a1'), at('evt-1', 1));
      await this.store.delete('a1', at('evt-2', 2));
      await this.store.delete('a2', at('evt-2', 2));

      this.expect(await stored('a1')).toEqual({ ...NO_DATA, id: 'a1' });
      this.expect(await stored('a2')).toEqual({ ...NO_DATA, id: 'a2' });
    });
  }

  private freesAUniqueValue(): void {
    if (this.storage.uniqueTitle !== true) {
      this.todo('frees the unique value of a deleted row (hold title unique, and tell the contract with uniqueTitle)');

      return;
    }

    this.it('frees the unique value of a deleted row, and holds several deleted rows', async () => {
      await this.put(row('a1'), at('evt-1', 1));
      await this.store.delete('a1', at('evt-2', 2));
      await this.store.delete('a2', at('evt-2', 2));

      this.expect(await this.put({ ...row('a3'), title: row('a1').title }, at('evt-3', 3))).toBe('applied');
      this.expect(await this.ids()).toEqual(['a3']);
    });
  }
}
