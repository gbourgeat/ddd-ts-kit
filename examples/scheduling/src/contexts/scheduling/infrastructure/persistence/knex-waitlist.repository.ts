import type { Knex } from 'knex';
import { Clock, ExecutionScope, stampCreation, stampUpdate } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { KnexContext, auditRow, insertIgnoringConflict, optimisticUpdate } from '@ddd-ts-kit/knex';
import type { Waitlist } from '#src/contexts/scheduling/domain/aggregates/waitlist.aggregate.js';
import { WaitlistRepository } from '#src/contexts/scheduling/domain/repositories/waitlist.repository.js';
import { SCHEDULING_SCHEMA } from '#src/contexts/scheduling/infrastructure/persistence/scheduling.schema.js';
import { WaitlistMapper } from '#src/contexts/scheduling/infrastructure/persistence/waitlist.mapper.js';
import type {
  WaitlistColumns,
  WaitlistRow,
} from '#src/contexts/scheduling/infrastructure/persistence/waitlist-row.schema.js';

type VersionedWaitlist = WaitlistColumns & { readonly version: number };

@Repository(WaitlistRepository, [KnexContext, ExecutionScope, Clock])
export class KnexWaitlistRepository implements WaitlistRepository {
  constructor(
    private readonly database: KnexContext,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Waitlist | undefined> {
    const row = await tableOf(this.database).where({ id }).first();

    return row === undefined ? undefined : WaitlistMapper.toDomain(row);
  }

  async save(saved: Waitlist): Promise<void> {
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...WaitlistMapper.toRow(saved), version: next };

      return expected === 0 ? this.insert(state) : this.update(state, expected);
    });
  }

  private async insert(state: VersionedWaitlist): Promise<number> {
    const row = { ...state, ...auditRow(stampCreation(this.scope, this.clock)) };

    return (await insertIgnoringConflict(this.database.executor(), tableOf(this.database), { row, conflict: 'id' }))
      ? 1
      : 0;
  }

  private async update(state: VersionedWaitlist, expected: number): Promise<number> {
    return tableOf(this.database)
      .where({ id: state.id, version: expected })
      .update({ ...state, ...auditRow(stampUpdate(this.scope, this.clock)) });
  }
}

/** A function and not a method: a query builder is thenable, and a method that answers one is read as asynchronous by whatever wraps the adapter (tracing), which then answers a promise. */
function tableOf(database: KnexContext): Knex.QueryBuilder<WaitlistRow, WaitlistRow[]> {
  return database.executor()<WaitlistRow, WaitlistRow[]>('waitlists').withSchema(SCHEDULING_SCHEMA);
}
