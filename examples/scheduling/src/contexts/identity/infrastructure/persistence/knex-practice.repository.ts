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
import type { Practice } from '@/contexts/identity/domain/aggregates/practice.aggregate';
import { PracticeRepository } from '@/contexts/identity/domain/repositories/practice.repository';
import { IDENTITY_SCHEMA } from '@/contexts/identity/infrastructure/persistence/identity.schema';
import { PracticeMapper } from '@/contexts/identity/infrastructure/persistence/practice.mapper';
import type { PracticeColumns, PracticeRow } from '@/contexts/identity/infrastructure/persistence/practice-row.schema';

type VersionedPractice = PracticeColumns & { readonly version: number };

/** Tenant data: every statement reaches it through `tenantTable` or `ownTenantTable`, confined to the tenant of the work. */
const TABLE = { schema: IDENTITY_SCHEMA, table: 'practices' };

@Repository(PracticeRepository)
export class KnexPracticeRepository implements PracticeRepository {
  constructor(
    private readonly database: KnexContext,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Practice | undefined> {
    const row = await tenantTable<PracticeRow>(this.database, this.scope, TABLE).where({ id }).first();

    return row === undefined ? undefined : PracticeMapper.toDomain(row);
  }

  async save(saved: Practice): Promise<void> {
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...PracticeMapper.toRow(saved), version: next };

      return expected === 0 ? this.insert(state) : this.update(state, expected);
    });
  }

  private async insert(state: VersionedPractice): Promise<number> {
    const row = {
      ...state,
      ...tenantRow(tenantScopeOf(this.scope)),
      ...auditRow(stampCreation(this.scope, this.clock)),
    };

    return (await insertIgnoringConflict(
      this.database.executor(),
      ownTenantTable<PracticeRow>(this.database, this.scope, TABLE),
      { row, conflict: 'id' },
    ))
      ? 1
      : 0;
  }

  private async update(state: VersionedPractice, expected: number): Promise<number> {
    return ownTenantTable<PracticeRow>(this.database, this.scope, TABLE)
      .where({ id: state.id, version: expected })
      .update({ ...state, ...auditRow(stampUpdate(this.scope, this.clock)) });
  }
}
