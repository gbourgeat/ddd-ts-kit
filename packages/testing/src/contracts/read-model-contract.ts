import { Criteria, RowNotHeldError, scoped, type ReadModelStore } from '@ddd-ts-kit/kernel';
import type { Awaitable } from './awaitable';
import type { ContractRunner } from './contract-runner';
import { ContractSuite } from './contract-suite';
import { failureOf } from './failure-of';
import { everything } from './read-model/everything';
import { stampedAt as at } from './read-model/stamped-at';

export interface ReadModelContractOptions<Row> {
  readonly name: string;
  /** A fresh, empty read model; called before each test. */
  createStore(): Awaitable<ReadModelStore<Row>>;
  /** A valid row of the read model kept under `key`, every field of it given a value. */
  createRow(key: string): Row;
  /**
   * The same row with one field changed, as a later event would write it. Optional: without it,
   * the case of the later event stays pending until the contract is given one.
   */
  readonly change?: (row: Row) => Row;
}

/**
 * What every adapter of the read model port of a context, fake or real, guarantees to its projection
 * and to its readers, on the rows of that context: a row read back as it was written, an event
 * applied once and never after a later one, a change refused until the row it changes is there,
 * a deletion that lasts, under a key it does not hold yet too, and a search that lists the rows.
 * `readModelStoreContract` holds the table of an ORM package; this one holds the port a context
 * declares over it.
 */
export function readModelContract<Row extends object>(
  runner: ContractRunner,
  options: ReadModelContractOptions<Row>,
): void {
  new ReadModelSuite(runner, options).describe(`${options.name} (read model contract)`);
}

class ReadModelSuite<Row extends object> extends ContractSuite<ReadModelStore<Row>> {
  constructor(
    runner: ContractRunner,
    private readonly options: ReadModelContractOptions<Row>,
  ) {
    super(runner, () => options.createStore());
  }

  protected tests(): void {
    this.keepsRows();
    this.appliesInOrder();
    this.appliesALaterEvent();
    this.changesARowItHolds();
    this.deletes();
    this.searches();
  }

  private keepsRows(): void {
    this.it('answers nothing for a key it does not hold', async () => {
      this.expect(await this.subject.get('row-1')).toBe(undefined);
    });

    this.it('gives back a row as it was written, every field of it', async () => {
      this.expect(await this.put('row-1', 1)).toBe('applied');
      this.expect(await this.subject.get('row-1')).toEqual(this.options.createRow('row-1'));
    });

    this.it('writes nothing when the change answers nothing', async () => {
      this.expect(await this.subject.upsertIfNewer('row-1', at('evt-1', 1), () => undefined)).toBe('ignored');
      this.expect(await this.subject.get('row-1')).toBe(undefined);
    });
  }

  private appliesInOrder(): void {
    this.it('ignores an event delivered twice', async () => {
      await this.put('row-1', 1);

      this.expect(await this.put('row-1', 1)).toBe('stale');
    });

    this.it('ignores an event older than what the row holds', async () => {
      await this.put('row-1', 2);

      this.expect(await this.put('row-1', 1)).toBe('stale');
      this.expect(await this.subject.get('row-1')).toEqual(this.options.createRow('row-1'));
    });
  }

  private appliesALaterEvent(): void {
    const { change } = this.options;

    if (change === undefined) {
      this.todo('hands the current row to a later event and keeps what it writes (give the contract a change)');

      return;
    }

    this.it('hands the current row to a later event and keeps what it writes', async () => {
      await this.put('row-1', 1);

      const changed = change(this.options.createRow('row-1'));
      const seen: (Row | undefined)[] = [];

      const written = await this.subject.upsertIfNewer('row-1', at('evt-2', 2), (current) => {
        seen.push(current);

        return changed;
      });

      this.expect(written).toBe('applied');
      this.expect(seen).toEqual([this.options.createRow('row-1')]);
      this.expect(await this.subject.get('row-1')).toEqual(changed);
    });
  }

  private changesARowItHolds(): void {
    const change = this.options.change ?? ((row: Row): Row => row);

    this.it('refuses a change delivered before its creation, then applies it after it', async () => {
      const refusal = await failureOf(() => this.subject.updateIfNewer('row-1', at('evt-2', 2), change));

      this.expect(refusal instanceof RowNotHeldError).toBe(true);
      this.expect(await this.subject.get('row-1')).toBe(undefined);

      await this.put('row-1', 1);

      this.expect(await this.subject.updateIfNewer('row-1', at('evt-2', 2), change)).toBe('applied');
      this.expect(await this.subject.updateIfNewer('row-1', at('evt-2', 2), change)).toBe('stale');
      this.expect(await this.subject.get('row-1')).toEqual(change(this.options.createRow('row-1')));
    });

    this.it('refuses a change later than the deletion of its row, and is stale for an older one', async () => {
      await this.put('row-1', 1);
      await this.subject.delete('row-1', at('evt-3', 3));

      const refusal = await failureOf(() => this.subject.updateIfNewer('row-1', at('evt-4', 4), change));

      this.expect(refusal instanceof RowNotHeldError).toBe(true);
      this.expect(await this.subject.updateIfNewer('row-1', at('evt-2', 2), change)).toBe('stale');
      this.expect(await this.subject.get('row-1')).toBe(undefined);
    });
  }

  private deletes(): void {
    this.it('removes a row, and an older event delivered late does not bring it back', async () => {
      await this.put('row-1', 1);

      this.expect(await this.subject.delete('row-1', at('evt-3', 3))).toBe('applied');
      this.expect(await this.put('row-1', 2)).toBe('stale');
      this.expect(await this.subject.get('row-1')).toBe(undefined);
    });

    this.it('keeps the trace of a deletion delivered before the creation it follows, which is then stale', async () => {
      this.expect(await this.subject.delete('row-1', at('evt-3', 3))).toBe('traced');
      this.expect(await this.put('row-1', 2)).toBe('stale');
      this.expect(await this.subject.get('row-1')).toBe(undefined);
    });

    this.it('writes the row of a later event over the trace of a key it never held', async () => {
      await this.subject.delete('row-1', at('evt-3', 3));

      this.expect(await this.put('row-1', 4)).toBe('applied');
      this.expect(await this.subject.get('row-1')).toEqual(this.options.createRow('row-1'));
    });
  }

  private searches(): void {
    this.it('lists the rows it holds, and none it removed', async () => {
      await this.put('row-1', 1);
      await this.put('row-2', 1);
      await this.put('row-3', 1);
      await this.subject.delete('row-3', at('evt-2', 2));

      const page = await this.subject.search(scoped(Criteria.of<Row>(), everything));
      const held = ['row-1', 'row-2'].map((key) => this.options.createRow(key));

      this.expect(inOneOrder(page.items)).toEqual(inOneOrder(held));
    });
  }

  private put(key: string, minute: number): Promise<string> {
    return this.subject.upsertIfNewer(key, at(`evt-${minute}`, minute), () => this.options.createRow(key));
  }
}

/** The rows in an order of their own, whatever the default sort of the read model: the contract knows no field of them. */
function inOneOrder<Row extends object>(rows: readonly Row[]): Row[] {
  return [...rows].sort((left, right) => textOf(left).localeCompare(textOf(right)));
}

function textOf(row: object): string {
  const fields = Object.entries(row).sort(([left], [right]) => left.localeCompare(right));

  return JSON.stringify(fields);
}
