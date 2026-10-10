import type { CriteriaPlan } from '../../application/criteria/criteria-plan.js';
import { selectRows } from '../../application/criteria/select-rows.js';
import type { ReadModelRows } from '../../application/ports/read-model-rows.js';
import type { ReadModelTable } from '../../application/ports/read-model-table.js';
import type { EventStamp } from '../../application/read-model/event-stamp.js';
import type { SearchedRows } from '../../application/read-model/searched-rows.js';
import type { StampedRow } from '../../application/read-model/stamped-row.js';
import type { TouchedKey } from '../../application/read-model/touched-key.js';

type Rows<Row> = Map<string, StampedRow<Row>>;

/**
 * The table of a read model in memory: the fake of every ORM adapter, held to the same
 * contract, rebuild included. Rows are kept and answered as copies.
 */
export class InMemoryReadModelTable<Row extends object> implements ReadModelTable<Row> {
  private live: Rows<Row> = new Map();

  private copy: Rows<Row> | undefined;

  private readonly marks = new Map<string, number>();

  async find(key: string): Promise<StampedRow<Row> | undefined> {
    return found(this.live, key);
  }

  async insert(entry: StampedRow<Row>): Promise<boolean> {
    return inserted(this.live, entry);
  }

  async replace(entry: StampedRow<Row>, held: EventStamp): Promise<boolean> {
    return replaced(this.live, entry, held);
  }

  async search(plan: CriteriaPlan): Promise<SearchedRows<Row>> {
    const rows = [...this.live.values()].flatMap(({ row }) => (row === undefined ? [] : [structuredClone(row)]));

    return selectRows(plan, rows);
  }

  async rebuilding(): Promise<boolean> {
    return this.copy !== undefined;
  }

  async touch(key: string): Promise<void> {
    this.marks.set(key, (this.marks.get(key) ?? 0) + 1);
  }

  async beginRebuild(): Promise<void> {
    this.copy = new Map([...this.live].filter(([, entry]) => entry.row === undefined));
    this.marks.clear();
  }

  shadow(): ReadModelRows<Row> {
    const rows = (): Rows<Row> => this.copy ?? new Map<string, StampedRow<Row>>();

    return {
      find: async (key) => found(rows(), key),
      insert: async (entry) => inserted(rows(), entry),
      replace: async (entry, held) => replaced(rows(), entry, held),
    };
  }

  async touched(limit: number): Promise<readonly TouchedKey[]> {
    return [...this.marks]
      .sort(([left], [right]) => (left < right ? -1 : 1))
      .slice(0, limit)
      .map(([key, mark]) => ({ key, mark }));
  }

  async settle(keys: readonly TouchedKey[]): Promise<void> {
    for (const { key, mark } of keys) {
      if (this.marks.get(key) === mark) {
        this.marks.delete(key);
      }
    }
  }

  async holdWriters(): Promise<void> {
    return Promise.resolve();
  }

  async promote(): Promise<void> {
    this.live = this.copy ?? this.live;
    this.copy = undefined;
    this.marks.clear();
  }

  async abandonRebuild(): Promise<void> {
    this.copy = undefined;
    this.marks.clear();
  }
}

function found<Row>(rows: Rows<Row>, key: string): StampedRow<Row> | undefined {
  const entry = rows.get(key);

  return entry === undefined ? undefined : structuredClone(entry);
}

function inserted<Row>(rows: Rows<Row>, entry: StampedRow<Row>): boolean {
  if (rows.has(entry.key)) {
    return false;
  }

  rows.set(entry.key, structuredClone(entry));

  return true;
}

function replaced<Row>(rows: Rows<Row>, entry: StampedRow<Row>, held: EventStamp): boolean {
  const current = rows.get(entry.key);

  if (current === undefined || !sameStamp(current.stamp, held)) {
    return false;
  }

  rows.set(entry.key, structuredClone({ ...entry, row: entry.row ?? undefined }));

  return true;
}

function sameStamp(left: EventStamp, right: EventStamp): boolean {
  return (
    left.eventId === right.eventId &&
    left.occurredAt.getTime() === right.occurredAt.getTime() &&
    left.version === right.version
  );
}
