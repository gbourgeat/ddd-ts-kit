import {
  ConcurrencyError,
  tenantScopeOf,
  type ExecutionScope,
  type ProcessStore,
  type StoredProcess,
} from '@ddd-ts-kit/kernel';
import type { PrismaContext } from '../unit-of-work/prisma-context';
import type { PrismaProcessChange, PrismaProcessDelegate, PrismaProcessKey } from './prisma-process-delegate';
import { timeoutsOf } from './timeouts-of';

export interface PrismaProcessStoreOptions<Tx> {
  /** How to reach the model of the process instances from a client: `(client) => client.processInstance`. */
  readonly delegate: (client: Tx) => PrismaProcessDelegate;
  /**
   * Keeps each instance in the tenant of the work that saves it, in `tenantId`: a step loads and
   * changes the instances of its own tenant only, two tenants may use the same correlation key,
   * and work that names no tenant is refused (`NoCurrentTenantError`). Left out, the instances
   * are those of no tenant.
   */
  readonly tenant?: ExecutionScope;
}

/**
 * The instances of the process managers in PostgreSQL, through Prisma Client, on the client of
 * the context: a step saves its state in the transaction of its unit of work. A first save
 * inserts, skipping a row a concurrent first save wrote; a next one updates the row at the
 * previous version; a save that changes no row is refused with `ConcurrencyError`. With `tenant`,
 * an instance of another tenant is neither found nor changed, whoever knows its key.
 */
export class PrismaProcessStore<Tx> implements ProcessStore {
  private readonly modelOf: (client: Tx) => PrismaProcessDelegate;

  private readonly tenant: ExecutionScope | undefined;

  constructor(
    private readonly context: PrismaContext<Tx>,
    options: PrismaProcessStoreOptions<Tx>,
  ) {
    this.modelOf = options.delegate;
    this.tenant = options.tenant;
  }

  async load(name: string, id: string): Promise<StoredProcess | undefined> {
    const row = await this.processes().findFirst({ where: this.keyOf(name, id) });

    if (row === null) {
      return undefined;
    }

    const state: unknown = JSON.parse(row.state);

    return { name, id, state, version: row.version, ended: row.ended, timeouts: timeoutsOf(row.timeouts) };
  }

  async save(process: StoredProcess): Promise<void> {
    const written = process.version === 1 ? await this.insert(process) : await this.update(process);

    if (written !== 1) {
      throw new ConcurrencyError(`${process.name}:${process.id}`);
    }
  }

  private async insert(process: StoredProcess): Promise<number> {
    // INSERT ... ON CONFLICT DO NOTHING: the loser of two first saves changes no row.
    const { count } = await this.processes().createMany({
      data: [{ ...this.keyOf(process.name, process.id), ...changeOf(process) }],
      skipDuplicates: true,
    });

    return count;
  }

  private async update(process: StoredProcess): Promise<number> {
    const { count } = await this.processes().updateMany({
      where: { ...this.keyOf(process.name, process.id), version: process.version - 1 },
      data: { ...changeOf(process), updatedAt: new Date() },
    });

    return count;
  }

  /** The tenant of the work with `tenant`, the empty text outside any tenant without. */
  private keyOf(name: string, id: string): PrismaProcessKey {
    return { tenantId: this.tenant === undefined ? '' : tenantScopeOf(this.tenant).tenantId, name, id };
  }

  private processes(): PrismaProcessDelegate {
    return this.modelOf(this.context.client());
  }
}

/** The state is kept as JSON text: it may be null, which a `Json` field takes only through the sentinel of the generated client. */
function changeOf({ state, version, ended, timeouts }: StoredProcess): PrismaProcessChange {
  return { state: JSON.stringify(state ?? null), version, ended, timeouts };
}
