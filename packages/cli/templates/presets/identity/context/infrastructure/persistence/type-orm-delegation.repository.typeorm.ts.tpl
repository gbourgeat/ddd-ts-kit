import { IsNull, type EntityManager } from 'typeorm';
import { stampCreation, stampUpdate, type Clock, type ExecutionScope } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Repository } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
import { type TypeOrmContext, insertIgnoringConflict, optimisticUpdate } from '@ddd-ts-kit/typeorm';
import type { Delegation } from '{{alias.context}}/domain/aggregates/delegation.aggregate{{alias.ext}}';
{{#if style.declared}}
import { DelegationRepository } from '{{alias.context}}/domain/repositories/delegation.repository{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import type { DelegationRepository } from '{{alias.context}}/domain/repositories/delegation.repository{{alias.ext}}';
{{/unless}}
import { delegations } from '{{alias.context}}/infrastructure/persistence/{{context.kebab}}.schema{{alias.ext}}';
import { DelegationMapper } from '{{alias.context}}/infrastructure/persistence/delegation.mapper{{alias.ext}}';
import type { DelegationColumns } from '{{alias.context}}/infrastructure/persistence/delegation-row.schema{{alias.ext}}';

type VersionedDelegation = DelegationColumns & { version: number };

{{#if style.declared}}
@Repository(DelegationRepository)
{{/if}}
export class TypeOrmDelegationRepository implements DelegationRepository {
  constructor(
    private readonly database: TypeOrmContext,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Delegation | undefined> {
    const row = await managerOf(this.database).findOneBy(delegations, { id });

    return row === null ? undefined : DelegationMapper.toDomain(row);
  }

  async findUnendedTo(organisationId: string, delegateId: string): Promise<readonly Delegation[]> {
    const rows = await managerOf(this.database).find(delegations, {
      where: { organisationId, delegateId, endedAt: IsNull() },
      order: { id: 'ASC' },
    });

    return rows.map((row) => DelegationMapper.toDomain(row));
  }

  async findUnendedInvolving(organisationId: string, accountId: string): Promise<readonly Delegation[]> {
    const unended = { organisationId, endedAt: IsNull() };

    const rows = await managerOf(this.database).find(delegations, {
      where: [
        { ...unended, delegatorId: accountId },
        { ...unended, delegateId: accountId },
      ],
      order: { id: 'ASC' },
    });

    return rows.map((row) => DelegationMapper.toDomain(row));
  }

  async save(saved: Delegation): Promise<void> {
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...DelegationMapper.toRow(saved), version: next };

      return expected === 0 ? this.insert(state) : this.update(state, expected);
    });
  }

  private async insert(state: VersionedDelegation): Promise<number> {
    const row = { ...state, ...stampCreation(this.scope, this.clock) };

    return (await insertIgnoringConflict(managerOf(this.database), delegations, row)) ? 1 : 0;
  }

  private async update(state: VersionedDelegation, expected: number): Promise<number> {
    const row = { ...state, ...stampUpdate(this.scope, this.clock) };

    const updated = await managerOf(this.database).update(delegations, { id: state.id, version: expected }, row);

    return updated.affected ?? 0;
  }
}

/** The manager of the unit of work, which every statement of this file goes through. */
function managerOf(database: TypeOrmContext): EntityManager {
{{#if tenancy.any}}
  // ddd-ts-kit-disable-next-line tenancy/scoped-statement -- {{preset.adr}}: the {{context.kebab}} context is the control plane of the tenants, and its rows belong to none of them.
{{/if}}
  return database.manager();
}
