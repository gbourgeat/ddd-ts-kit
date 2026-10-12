import type { Knex } from 'knex';
import { Clock, ExecutionScope, stampCreation, stampUpdate } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { KnexContext, auditRow, insertIgnoringConflict, optimisticUpdate } from '@ddd-ts-kit/knex';
import type { Practice } from '@/contexts/identity/domain/aggregates/practice.aggregate';
import { PracticeRepository } from '@/contexts/identity/domain/repositories/practice.repository';
import { IDENTITY_SCHEMA } from '@/contexts/identity/infrastructure/persistence/identity.schema';
import { PracticeMapper } from '@/contexts/identity/infrastructure/persistence/practice.mapper';
import type { PracticeColumns, PracticeRow } from '@/contexts/identity/infrastructure/persistence/practice-row.schema';

type VersionedPractice = PracticeColumns & { readonly version: number };

@Repository(PracticeRepository)
export class KnexPracticeRepository implements PracticeRepository {
  constructor(
    private readonly database: KnexContext,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Practice | undefined> {
    const row = await tableOf(this.database).where({ id }).first();

    return row === undefined ? undefined : PracticeMapper.toDomain(row);
  }

  async save(saved: Practice): Promise<void> {
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...PracticeMapper.toRow(saved), version: next };

      return expected === 0 ? this.insert(state) : this.update(state, expected);
    });
  }

  private async insert(state: VersionedPractice): Promise<number> {
    const row = { ...state, ...auditRow(stampCreation(this.scope, this.clock)) };

    return (await insertIgnoringConflict(this.database.executor(), tableOf(this.database), { row, conflict: 'id' }))
      ? 1
      : 0;
  }

  private async update(state: VersionedPractice, expected: number): Promise<number> {
    return tableOf(this.database)
      .where({ id: state.id, version: expected })
      .update({ ...state, ...auditRow(stampUpdate(this.scope, this.clock)) });
  }
}

/** A function and not a method: a query builder is thenable, and a method that answers one is read as asynchronous by whatever wraps the adapter (tracing), which then answers a promise. */
function tableOf(database: KnexContext): Knex.QueryBuilder<PracticeRow, PracticeRow[]> {
  return database.executor()<PracticeRow, PracticeRow[]>('practices').withSchema(IDENTITY_SCHEMA);
}
