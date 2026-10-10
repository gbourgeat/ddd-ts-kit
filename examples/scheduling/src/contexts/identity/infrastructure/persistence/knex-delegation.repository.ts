import type { Knex } from 'knex';
import { Clock, ExecutionScope, stampCreation, stampUpdate } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { KnexContext, auditRow, insertIgnoringConflict, optimisticUpdate } from '@ddd-ts-kit/knex';
import type { Delegation } from '#src/contexts/identity/domain/aggregates/delegation.aggregate.js';
import type { Desk } from '#src/contexts/identity/domain/value-objects/desk.vo.js';
import { DelegationRepository } from '#src/contexts/identity/domain/repositories/delegation.repository.js';
import { IDENTITY_SCHEMA } from '#src/contexts/identity/infrastructure/persistence/identity.schema.js';
import { DelegationMapper } from '#src/contexts/identity/infrastructure/persistence/delegation.mapper.js';
import type {
  DelegationColumns,
  DelegationRow,
} from '#src/contexts/identity/infrastructure/persistence/delegation-row.schema.js';

type VersionedDelegation = DelegationColumns & { readonly version: number };

@Repository(DelegationRepository, [KnexContext, ExecutionScope, Clock])
export class KnexDelegationRepository implements DelegationRepository {
  constructor(
    private readonly database: KnexContext,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Delegation | undefined> {
    const row = await tableOf(this.database).where({ id }).first();

    return row === undefined ? undefined : DelegationMapper.toDomain(row);
  }

  async findActiveBetween(desk: Desk, assistantId: string): Promise<Delegation | undefined> {
    const row = await tableOf(this.database)
      .where({ practice_id: desk.practiceId, practitioner_id: desk.practitionerId, assistant_id: assistantId })
      .whereNull('ended_at')
      .first();

    return row === undefined ? undefined : DelegationMapper.toDomain(row);
  }

  async findActiveOfMember(practiceId: string, personId: string): Promise<readonly Delegation[]> {
    const rows = await tableOf(this.database)
      .where({ practice_id: practiceId })
      .whereNull('ended_at')
      .where((either) => {
        void either.where({ practitioner_id: personId }).orWhere({ assistant_id: personId });
      })
      .orderBy('id');

    return rows.map((row) => DelegationMapper.toDomain(row));
  }

  async findDueAt(instant: Date): Promise<readonly Delegation[]> {
    const rows = await tableOf(this.database).whereNull('ended_at').where('ends_at', '<=', instant).orderBy('id');

    return rows.map((row) => DelegationMapper.toDomain(row));
  }

  async save(saved: Delegation): Promise<void> {
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...DelegationMapper.toRow(saved), version: next };

      return expected === 0 ? this.insert(state) : this.update(state, expected);
    });
  }

  private async insert(state: VersionedDelegation): Promise<number> {
    const row = { ...state, ...auditRow(stampCreation(this.scope, this.clock)) };

    return (await insertIgnoringConflict(this.database.executor(), tableOf(this.database), { row, conflict: 'id' }))
      ? 1
      : 0;
  }

  private async update(state: VersionedDelegation, expected: number): Promise<number> {
    return tableOf(this.database)
      .where({ id: state.id, version: expected })
      .update({ ...state, ...auditRow(stampUpdate(this.scope, this.clock)) });
  }
}

/** A function and not a method: a query builder is thenable, and a method that answers one is read as asynchronous by whatever wraps the adapter (tracing), which then answers a promise. */
function tableOf(database: KnexContext): Knex.QueryBuilder<DelegationRow, DelegationRow[]> {
  return database.executor()<DelegationRow, DelegationRow[]>('delegations').withSchema(IDENTITY_SCHEMA);
}
