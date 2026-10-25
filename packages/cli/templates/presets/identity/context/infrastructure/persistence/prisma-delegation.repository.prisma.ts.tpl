import { optimisticUpdate } from '@ddd-ts-kit/prisma';
import { stampCreation, stampUpdate, type Clock, type ExecutionScope } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Repository } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
import type { Delegation } from '{{alias.context}}/domain/aggregates/delegation.aggregate{{alias.ext}}';
{{#if style.declared}}
import { DelegationRepository } from '{{alias.context}}/domain/repositories/delegation.repository{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import type { DelegationRepository } from '{{alias.context}}/domain/repositories/delegation.repository{{alias.ext}}';
{{/unless}}
import type { Database } from '{{alias.platform}}/database/database{{alias.ext}}';
import { DelegationMapper, type DelegationColumns } from '{{alias.context}}/infrastructure/persistence/delegation.mapper{{alias.ext}}';

type VersionedDelegation = DelegationColumns & { readonly version: number };

{{#if style.declared}}
@Repository(DelegationRepository)
{{/if}}
export class PrismaDelegationRepository implements DelegationRepository {
  constructor(
    private readonly database: Database,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Delegation | undefined> {
    const row = await delegationsOf(this.database).findUnique({ where: { id } });

    return row === null ? undefined : DelegationMapper.toDomain(row);
  }

  async findUnendedTo(organisationId: string, delegateId: string): Promise<readonly Delegation[]> {
    const rows = await delegationsOf(this.database).findMany({
      where: { organisationId, delegateId, endedAt: null },
      orderBy: { id: 'asc' },
    });

    return rows.map((row) => DelegationMapper.toDomain(row));
  }

  async findUnendedInvolving(organisationId: string, accountId: string): Promise<readonly Delegation[]> {
    const rows = await delegationsOf(this.database).findMany({
      where: { organisationId, endedAt: null, OR: [{ delegatorId: accountId }, { delegateId: accountId }] },
      orderBy: { id: 'asc' },
    });

    return rows.map((row) => DelegationMapper.toDomain(row));
  }

  async save(saved: Delegation): Promise<void> {
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...DelegationMapper.toRow(saved), version: next };
      const written = expected === 0 ? await this.insert(state) : await this.update(state, expected);

      return written.count;
    });
  }

  private insert(state: VersionedDelegation): Promise<{ count: number }> {
    const row = { ...state, ...stampCreation(this.scope, this.clock) };

    return delegationsOf(this.database).createMany({ data: [row], skipDuplicates: true });
  }

  private update(state: VersionedDelegation, expected: number): Promise<{ count: number }> {
    return delegationsOf(this.database).updateMany({
      where: { id: state.id, version: expected },
      data: { ...state, ...stampUpdate(this.scope, this.clock) },
    });
  }
}

/** The delegations on the client of the unit of work, which every statement of this file goes through. */
function delegationsOf(database: Database): ReturnType<Database['client']>['{{context.camel}}Delegation'] {
{{#if tenancy.any}}
  // ddd-ts-kit-disable-next-line tenancy/scoped-statement -- {{preset.adr}}: the {{context.kebab}} context is the control plane of the tenants, and its rows belong to none of them.
{{/if}}
  return database.client().{{context.camel}}Delegation;
}
