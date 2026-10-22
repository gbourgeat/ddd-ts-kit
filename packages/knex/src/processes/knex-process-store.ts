import type { Knex } from 'knex';
import {
  ConcurrencyError,
  tenantScopeOf,
  type ExecutionScope,
  type ProcessStore,
  type StoredProcess,
} from '@ddd-ts-kit/kernel';
import { tenantRow } from '../columns/tenant-row';
import { TENANT_COLUMN } from '../tenancy/where-tenant';
import type { KnexContext } from '../unit-of-work/knex-context';
import { PROCESS_TABLE } from './process-table-name';
import type { ProcessTableOptions } from './process-table-options';

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

export interface KnexProcessStoreOptions extends Omit<ProcessTableOptions, 'tenant'> {
  /**
   * Keeps each instance in the tenant of the work that saves it, in the `tenant_id` that
   * `createProcessTable(knex, { tenant: true })` added: a step loads and changes the instances of
   * its own tenant only, and work that names no tenant is refused (`NoCurrentTenantError`). Left
   * out, the instances are shared, as before.
   */
  readonly tenant?: ExecutionScope;
}

/**
 * The instances of the process managers in a PostgreSQL table, on the executor of the context:
 * a step saves its state in the transaction of its unit of work. A first save inserts, ignoring
 * a row that a concurrent first save wrote; a next one updates the row at the previous version;
 * a save that changes no row is refused with `ConcurrencyError`. With `tenant`, an instance of
 * another tenant is neither found nor changed, whoever knows its key.
 */
export class KnexProcessStore implements ProcessStore {
  private readonly schemaName: string | undefined;

  private readonly tableName: string;

  private readonly tenant: ExecutionScope | undefined;

  constructor(
    private readonly context: KnexContext,
    options: KnexProcessStoreOptions = {},
  ) {
    this.schemaName = options.schema;
    this.tableName = options.table ?? PROCESS_TABLE;
    this.tenant = options.tenant;
  }

  async load(name: string, id: string): Promise<StoredProcess | undefined> {
    const row = await this.owned(this.context.executor()).where({ name, id }).first();

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
      .insert({ ...this.columns(process), ...this.tenantOfWork(), name: process.name, id: process.id })
      .onConflict(['name', 'id'])
      .ignore()
      .returning('id');

    return inserted.length;
  }

  private async update(executor: Knex, process: StoredProcess): Promise<number> {
    return await this.owned(executor)
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

  /** The rows of the tenant of the work, with `tenant`; every row without. */
  private owned(executor: Knex): Rows {
    const rows = this.rows(executor);

    return this.tenant === undefined ? rows : rows.where(TENANT_COLUMN, tenantScopeOf(this.tenant).tenantId);
  }

  private tenantOfWork(): Readonly<Record<string, string>> {
    return this.tenant === undefined ? {} : { ...tenantRow(tenantScopeOf(this.tenant)) };
  }

  private rows(executor: Knex): Rows {
    const table = executor<ProcessRow, ProcessRow[]>(this.tableName);

    return this.schemaName === undefined ? table : table.withSchema(this.schemaName);
  }
}
