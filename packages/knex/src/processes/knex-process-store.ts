import type { Knex } from 'knex';
import { ConcurrencyError, type ProcessStore, type StoredProcess } from '@ddd-ts-kit/kernel';
import type { KnexContext } from '../unit-of-work/knex-context.js';
import { PROCESS_TABLE } from './process-table-name.js';
import type { ProcessTableOptions } from './process-table-options.js';

interface ProcessRow {
  name: string;
  id: string;
  state: unknown;
  version: number;
  ended: boolean;
  timeouts: Record<string, string>;
  updated_at: Date;
}

type Rows = Knex.QueryBuilder<ProcessRow, ProcessRow[]>;

/**
 * The instances of the process managers in a PostgreSQL table, on the executor of the context:
 * a step saves its state in the transaction of its unit of work. A first save inserts, ignoring
 * a row that a concurrent first save wrote; a next one updates the row at the previous version;
 * a save that changes no row is refused with `ConcurrencyError`.
 */
export class KnexProcessStore implements ProcessStore {
  private readonly schemaName: string | undefined;

  private readonly tableName: string;

  constructor(
    private readonly context: KnexContext,
    options: ProcessTableOptions = {},
  ) {
    this.schemaName = options.schema;
    this.tableName = options.table ?? PROCESS_TABLE;
  }

  async load(name: string, id: string): Promise<StoredProcess | undefined> {
    const row = await this.rows(this.context.executor()).where({ name, id }).first();

    if (row === undefined) {
      return undefined;
    }

    return { name, id, state: row.state, version: row.version, ended: row.ended, timeouts: { ...row.timeouts } };
  }

  async save(process: StoredProcess): Promise<void> {
    const executor = this.context.executor();
    const written = process.version === 1 ? await this.insert(executor, process) : await this.update(executor, process);

    if (written !== 1) {
      throw new ConcurrencyError(`${process.name}:${process.id}`);
    }
  }

  private async insert(executor: Knex, process: StoredProcess): Promise<number> {
    const inserted: unknown[] = await this.rows(executor)
      .insert({ ...this.columns(process), name: process.name, id: process.id })
      .onConflict(['name', 'id'])
      .ignore()
      .returning('id');

    return inserted.length;
  }

  private async update(executor: Knex, process: StoredProcess): Promise<number> {
    return await this.rows(executor)
      .where({ name: process.name, id: process.id, version: process.version - 1 })
      .update({ ...this.columns(process), updated_at: executor.fn.now(3) });
  }

  private columns(process: StoredProcess): Readonly<Record<string, unknown>> {
    return {
      // Serialized here: drivers would send a JS array as a SQL array, not as JSON.
      state: JSON.stringify(process.state ?? null),
      version: process.version,
      ended: process.ended,
      timeouts: JSON.stringify(process.timeouts),
    };
  }

  private rows(executor: Knex): Rows {
    const table = executor<ProcessRow, ProcessRow[]>(this.tableName);

    return this.schemaName === undefined ? table : table.withSchema(this.schemaName);
  }
}
