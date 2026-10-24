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
import type { Person } from '@/contexts/identity/domain/aggregates/person.aggregate';
import { PersonRepository } from '@/contexts/identity/domain/repositories/person.repository';
import { IDENTITY_SCHEMA } from '@/contexts/identity/infrastructure/persistence/identity.schema';
import { PersonMapper } from '@/contexts/identity/infrastructure/persistence/person.mapper';
import type { PersonColumns, PersonRow } from '@/contexts/identity/infrastructure/persistence/person-row.schema';

type VersionedPerson = PersonColumns & { readonly version: number };

/** Tenant data: every statement reaches it through `tenantTable` or `ownTenantTable`, confined to the tenant of the work. */
const TABLE = { schema: IDENTITY_SCHEMA, table: 'persons' };

@Repository(PersonRepository)
export class KnexPersonRepository implements PersonRepository {
  constructor(
    private readonly database: KnexContext,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Person | undefined> {
    const row = await tenantTable<PersonRow>(this.database, this.scope, TABLE).where({ id }).first();

    return row === undefined ? undefined : PersonMapper.toDomain(row);
  }

  /** Deletes the row of the person in the network of the work: nothing of the name or the address stays in this table. */
  async erase(personId: string): Promise<boolean> {
    const deleted = await ownTenantTable<PersonRow>(this.database, this.scope, TABLE).where({ id: personId }).delete();

    return deleted > 0;
  }

  async save(saved: Person): Promise<void> {
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...PersonMapper.toRow(saved), version: next };

      return expected === 0 ? this.insert(state) : this.update(state, expected);
    });
  }

  private async insert(state: VersionedPerson): Promise<number> {
    const row = {
      ...state,
      ...tenantRow(tenantScopeOf(this.scope)),
      ...auditRow(stampCreation(this.scope, this.clock)),
    };

    return (await insertIgnoringConflict(
      this.database.executor(),
      ownTenantTable<PersonRow>(this.database, this.scope, TABLE),
      { row, conflict: 'id' },
    ))
      ? 1
      : 0;
  }

  private async update(state: VersionedPerson, expected: number): Promise<number> {
    return ownTenantTable<PersonRow>(this.database, this.scope, TABLE)
      .where({ id: state.id, version: expected })
      .update({ ...state, ...auditRow(stampUpdate(this.scope, this.clock)) });
  }
}
