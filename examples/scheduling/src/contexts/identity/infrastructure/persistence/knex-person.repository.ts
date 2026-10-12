import type { Knex } from 'knex';
import { type Clock, type ExecutionScope, stampCreation, stampUpdate } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { KnexContext, auditRow, insertIgnoringConflict, optimisticUpdate } from '@ddd-ts-kit/knex';
import type { Person } from '@/contexts/identity/domain/aggregates/person.aggregate';
import { PersonRepository } from '@/contexts/identity/domain/repositories/person.repository';
import { IDENTITY_SCHEMA } from '@/contexts/identity/infrastructure/persistence/identity.schema';
import { PersonMapper } from '@/contexts/identity/infrastructure/persistence/person.mapper';
import type { PersonColumns, PersonRow } from '@/contexts/identity/infrastructure/persistence/person-row.schema';

type VersionedPerson = PersonColumns & { readonly version: number };

@Repository(PersonRepository)
export class KnexPersonRepository implements PersonRepository {
  constructor(
    private readonly database: KnexContext,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Person | undefined> {
    const row = await tableOf(this.database).where({ id }).first();

    return row === undefined ? undefined : PersonMapper.toDomain(row);
  }

  async save(saved: Person): Promise<void> {
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...PersonMapper.toRow(saved), version: next };

      return expected === 0 ? this.insert(state) : this.update(state, expected);
    });
  }

  private async insert(state: VersionedPerson): Promise<number> {
    const row = { ...state, ...auditRow(stampCreation(this.scope, this.clock)) };

    return (await insertIgnoringConflict(this.database.executor(), tableOf(this.database), { row, conflict: 'id' }))
      ? 1
      : 0;
  }

  private async update(state: VersionedPerson, expected: number): Promise<number> {
    return tableOf(this.database)
      .where({ id: state.id, version: expected })
      .update({ ...state, ...auditRow(stampUpdate(this.scope, this.clock)) });
  }
}

/** A function and not a method: a query builder is thenable, and a method that answers one is read as asynchronous by whatever wraps the adapter (tracing), which then answers a promise. */
function tableOf(database: KnexContext): Knex.QueryBuilder<PersonRow, PersonRow[]> {
  return database.executor()<PersonRow, PersonRow[]>('persons').withSchema(IDENTITY_SCHEMA);
}
