import type { EntitySchema } from 'typeorm';
import { ConcurrencyError, type ProcessStore, type StoredProcess } from '@ddd-ts-kit/kernel';
import { insertIgnoringConflict } from '../sql/insert-ignoring-conflict';
import type { TypeOrmContext } from '../unit-of-work/type-orm-context';
import { processEntity } from './process-entity';
import type { ProcessRow } from './process-row';

export interface TypeOrmProcessStoreOptions {
  /** Default `processEntity()`, which must then be the one the data source registers. */
  readonly entity?: EntitySchema<ProcessRow>;
}

/**
 * The instances of the process managers in PostgreSQL, through TypeORM, on the manager of the
 * context: a step saves its state in the transaction of its unit of work. A first save inserts,
 * ignoring a row a concurrent first save wrote; a next one updates the row at the previous
 * version; a save that changes no row is refused with `ConcurrencyError`.
 */
export class TypeOrmProcessStore implements ProcessStore {
  private readonly processes: EntitySchema<ProcessRow>;

  constructor(
    private readonly context: TypeOrmContext,
    options: TypeOrmProcessStoreOptions = {},
  ) {
    this.processes = options.entity ?? processEntity();
  }

  async load(name: string, id: string): Promise<StoredProcess | undefined> {
    const row = await this.context.manager().findOneBy(this.processes, { name, id });

    if (row === null) {
      return undefined;
    }

    return { name, id, state: row.state, version: row.version, ended: row.ended, timeouts: { ...row.timeouts } };
  }

  async save(process: StoredProcess): Promise<void> {
    const written = process.version === 1 ? await this.insert(process) : await this.update(process);

    if (!written) {
      throw new ConcurrencyError(`${process.name}:${process.id}`);
    }
  }

  private insert({ name, id, state, version, ended, timeouts }: StoredProcess): Promise<boolean> {
    return insertIgnoringConflict(this.context.manager(), this.processes, {
      name,
      id,
      state: state ?? null,
      version,
      ended,
      timeouts,
    });
  }

  private async update({ name, id, state, version, ended, timeouts }: StoredProcess): Promise<boolean> {
    const updated = await this.context
      .manager()
      .update(
        this.processes,
        { name, id, version: version - 1 },
        { state: state ?? null, version, ended, timeouts, updatedAt: new Date() },
      );

    return updated.affected === 1;
  }
}
