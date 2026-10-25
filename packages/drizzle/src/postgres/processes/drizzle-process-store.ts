import { and, eq, type TablesRelationalConfig } from 'drizzle-orm';
import type { PgQueryResultHKT } from 'drizzle-orm/pg-core';
import {
  ConcurrencyError,
  tenantScopeOf,
  type ExecutionScope,
  type ProcessStore,
  type StoredProcess,
} from '@ddd-ts-kit/kernel';
import type { DrizzleContext } from '../unit-of-work/drizzle-context';
import { processesTable, type ProcessesTable } from './processes-table';

export interface DrizzleProcessStoreOptions {
  /** Default `processesTable()`, in the public schema. */
  readonly table?: ProcessesTable;
  /**
   * Keeps each instance in the tenant of the work that saves it, in `tenant_id`: a step loads and
   * changes the instances of its own tenant only, two tenants may use the same correlation key,
   * and work that names no tenant is refused (`NoCurrentTenantError`). Left out, the instances
   * are those of no tenant.
   */
  readonly tenant?: ExecutionScope;
}

/**
 * The instances of the process managers in PostgreSQL, on the executor of the context: a first
 * save inserts, ignoring a row a concurrent first save wrote; a next one updates the row at the
 * previous version; a save that changes no row is refused with `ConcurrencyError`. With `tenant`,
 * an instance of another tenant is neither found nor changed, whoever knows its key.
 */
export class DrizzleProcessStore<
  Q extends PgQueryResultHKT,
  F extends Record<string, unknown>,
  S extends TablesRelationalConfig,
> implements ProcessStore
{
  private readonly processes: ProcessesTable;

  private readonly tenant: ExecutionScope | undefined;

  constructor(
    private readonly context: DrizzleContext<Q, F, S>,
    options: DrizzleProcessStoreOptions = {},
  ) {
    this.processes = options.table ?? processesTable();
    this.tenant = options.tenant;
  }

  async load(name: string, id: string): Promise<StoredProcess | undefined> {
    const { processes } = this;

    const [row] = await this.context
      .executor()
      .select({
        state: processes.state,
        version: processes.version,
        ended: processes.ended,
        timeouts: processes.timeouts,
      })
      .from(processes)
      .where(and(eq(processes.tenantId, this.tenantOfWork()), eq(processes.name, name), eq(processes.id, id)));

    return row === undefined ? undefined : { name, id, ...row, timeouts: { ...row.timeouts } };
  }

  async save(process: StoredProcess): Promise<void> {
    const written = process.version === 1 ? await this.insert(process) : await this.update(process);

    if (written !== 1) {
      throw new ConcurrencyError(`${process.name}:${process.id}`);
    }
  }

  private async insert({ name, id, state, version, ended, timeouts }: StoredProcess): Promise<number> {
    const tenantId = this.tenantOfWork();

    const inserted = await this.context
      .executor()
      .insert(this.processes)
      .values({ tenantId, name, id, state, version, ended, timeouts })
      .onConflictDoNothing()
      .returning({ id: this.processes.id });

    return inserted.length;
  }

  private async update({ name, id, state, version, ended, timeouts }: StoredProcess): Promise<number> {
    const { processes } = this;
    const tenantId = this.tenantOfWork();

    const updated = await this.context
      .executor()
      .update(processes)
      .set({ state, version, ended, timeouts, updatedAt: new Date() })
      .where(
        and(
          eq(processes.tenantId, tenantId),
          eq(processes.name, name),
          eq(processes.id, id),
          eq(processes.version, version - 1),
        ),
      )
      .returning({ id: processes.id });

    return updated.length;
  }

  /** The empty text outside any tenant, as the table keeps it. */
  private tenantOfWork(): string {
    return this.tenant === undefined ? '' : tenantScopeOf(this.tenant).tenantId;
  }
}
