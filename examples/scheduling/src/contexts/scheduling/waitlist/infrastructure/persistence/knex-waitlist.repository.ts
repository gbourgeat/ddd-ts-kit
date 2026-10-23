import { type Clock, type ExecutionScope, stampCreation, stampUpdate, tenantScopeOf } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import {
  KnexContext,
  auditRow,
  insertIgnoringConflict,
  optimisticUpdate,
  ownTenantTable,
  tenantRow,
  tenantTable,
} from '@ddd-ts-kit/knex';
import type { Waitlist } from '@/contexts/scheduling/waitlist/domain/aggregates/waitlist.aggregate';
import { WaitlistRepository } from '@/contexts/scheduling/waitlist/domain/repositories/waitlist.repository';
import { SCHEDULING_SCHEMA } from '@/contexts/scheduling/infrastructure/persistence/scheduling.schema';
import { WaitlistMapper } from '@/contexts/scheduling/waitlist/infrastructure/persistence/waitlist.mapper';
import type {
  WaitlistColumns,
  WaitlistRow,
} from '@/contexts/scheduling/waitlist/infrastructure/persistence/waitlist-row.schema';

type VersionedWaitlist = WaitlistColumns & { readonly version: number };

/** Tenant data: every statement reaches it through `tenantTable` or `ownTenantTable`, confined to the tenant of the work. */
const TABLE = { schema: SCHEDULING_SCHEMA, table: 'waitlists' };

@Repository(WaitlistRepository)
export class KnexWaitlistRepository implements WaitlistRepository {
  constructor(
    private readonly database: KnexContext,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Waitlist | undefined> {
    const row = await tenantTable<WaitlistRow>(this.database, this.scope, TABLE).where({ id }).first();

    return row === undefined ? undefined : WaitlistMapper.toDomain(row);
  }

  async save(saved: Waitlist): Promise<void> {
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...WaitlistMapper.toRow(saved), version: next };

      return expected === 0 ? this.insert(state) : this.update(state, expected);
    });
  }

  private async insert(state: VersionedWaitlist): Promise<number> {
    const row = {
      ...state,
      ...tenantRow(tenantScopeOf(this.scope)),
      ...auditRow(stampCreation(this.scope, this.clock)),
    };

    return (await insertIgnoringConflict(
      this.database.executor(),
      ownTenantTable<WaitlistRow>(this.database, this.scope, TABLE),
      { row, conflict: 'id' },
    ))
      ? 1
      : 0;
  }

  private async update(state: VersionedWaitlist, expected: number): Promise<number> {
    return ownTenantTable<WaitlistRow>(this.database, this.scope, TABLE)
      .where({ id: state.id, version: expected })
      .update({ ...state, ...auditRow(stampUpdate(this.scope, this.clock)) });
  }
}
