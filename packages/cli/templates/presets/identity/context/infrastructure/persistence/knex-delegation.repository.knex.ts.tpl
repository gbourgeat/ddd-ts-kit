import type { Knex } from 'knex';
import { stampCreation, stampUpdate, type Clock, type ExecutionScope } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Repository } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
import { type KnexContext, auditRow, insertIgnoringConflict, optimisticUpdate } from '@ddd-ts-kit/knex';
import type { Delegation } from '{{alias.context}}/domain/aggregates/delegation.aggregate{{alias.ext}}';
{{#if style.declared}}
import { DelegationRepository } from '{{alias.context}}/domain/repositories/delegation.repository{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import type { DelegationRepository } from '{{alias.context}}/domain/repositories/delegation.repository{{alias.ext}}';
{{/unless}}
import { {{context.constant}}_SCHEMA } from '{{alias.context}}/infrastructure/persistence/{{context.kebab}}.schema{{alias.ext}}';
import { DelegationMapper } from '{{alias.context}}/infrastructure/persistence/delegation.mapper{{alias.ext}}';
import type { DelegationColumns, DelegationRow } from '{{alias.context}}/infrastructure/persistence/delegation-row.schema{{alias.ext}}';

type VersionedDelegation = DelegationColumns & { readonly version: number };

{{#if style.declared}}
@Repository(DelegationRepository)
{{/if}}
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

  async findUnendedTo(organisationId: string, delegateId: string): Promise<readonly Delegation[]> {
    const lentTo = { organisation_id: organisationId, delegate_id: delegateId };
    const rows = await tableOf(this.database).where(lentTo).whereNull('ended_at').orderBy('id');

    return rows.map((row) => DelegationMapper.toDomain(row));
  }

  async findUnendedInvolving(organisationId: string, accountId: string): Promise<readonly Delegation[]> {
    const rows = await tableOf(this.database)
      .where({ organisation_id: organisationId })
      .whereNull('ended_at')
      .where((either) => {
        void either.where({ delegator_id: accountId }).orWhere({ delegate_id: accountId });
      })
      .orderBy('id');

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

    const inserted = await insertIgnoringConflict(this.database.executor(), tableOf(this.database), {
      row,
      conflict: 'id',
    });

    return inserted ? 1 : 0;
  }

  private async update(state: VersionedDelegation, expected: number): Promise<number> {
    return tableOf(this.database)
      .where({ id: state.id, version: expected })
      .update({ ...state, ...auditRow(stampUpdate(this.scope, this.clock)) });
  }
}

/** A function and not a method: a query builder is thenable, and a method that answers one is read as asynchronous by whatever wraps the adapter (tracing), which then answers a promise. */
function tableOf(database: KnexContext): Knex.QueryBuilder<DelegationRow, DelegationRow[]> {
  const table = database.executor()<DelegationRow, DelegationRow[]>('delegations');

  return table.withSchema({{context.constant}}_SCHEMA);
}
