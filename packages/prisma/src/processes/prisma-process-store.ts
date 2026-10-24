import { ConcurrencyError, type ProcessStore, type StoredProcess } from '@ddd-ts-kit/kernel';
import type { PrismaContext } from '../unit-of-work/prisma-context';
import type { PrismaProcessChange, PrismaProcessDelegate } from './prisma-process-delegate';
import { timeoutsOf } from './timeouts-of';

export interface PrismaProcessStoreOptions<Tx> {
  /** How to reach the model of the process instances from a client: `(client) => client.processInstance`. */
  readonly delegate: (client: Tx) => PrismaProcessDelegate;
}

/**
 * The instances of the process managers in PostgreSQL, through Prisma Client, on the client of
 * the context: a step saves its state in the transaction of its unit of work. A first save
 * inserts, skipping a row a concurrent first save wrote; a next one updates the row at the
 * previous version; a save that changes no row is refused with `ConcurrencyError`.
 */
export class PrismaProcessStore<Tx> implements ProcessStore {
  private readonly modelOf: (client: Tx) => PrismaProcessDelegate;

  constructor(
    private readonly context: PrismaContext<Tx>,
    options: PrismaProcessStoreOptions<Tx>,
  ) {
    this.modelOf = options.delegate;
  }

  async load(name: string, id: string): Promise<StoredProcess | undefined> {
    const row = await this.processes().findFirst({ where: { name, id } });

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
      data: [{ name: process.name, id: process.id, ...changeOf(process) }],
      skipDuplicates: true,
    });

    return count;
  }

  private async update(process: StoredProcess): Promise<number> {
    const { count } = await this.processes().updateMany({
      where: { name: process.name, id: process.id, version: process.version - 1 },
      data: { ...changeOf(process), updatedAt: new Date() },
    });

    return count;
  }

  private processes(): PrismaProcessDelegate {
    return this.modelOf(this.context.client());
  }
}

/** The state is kept as JSON text: it may be null, which a `Json` field takes only through the sentinel of the generated client. */
function changeOf({ state, version, ended, timeouts }: StoredProcess): PrismaProcessChange {
  return { state: JSON.stringify(state ?? null), version, ended, timeouts };
}
