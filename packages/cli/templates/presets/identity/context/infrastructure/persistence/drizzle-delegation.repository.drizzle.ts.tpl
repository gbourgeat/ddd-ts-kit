import { and, eq, isNull, or } from 'drizzle-orm';
import { optimisticUpdate, primaryKeyOf } from '@ddd-ts-kit/drizzle/postgres';
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
import { delegations } from '{{alias.context}}/infrastructure/persistence/{{context.kebab}}.schema{{alias.ext}}';
import { DelegationMapper, type DelegationColumns } from '{{alias.context}}/infrastructure/persistence/delegation.mapper{{alias.ext}}';

type VersionedDelegation = DelegationColumns & { readonly version: number };

{{#if style.declared}}
@Repository(DelegationRepository)
{{/if}}
export class DrizzleDelegationRepository implements DelegationRepository {
  constructor(
    private readonly database: Database,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Delegation | undefined> {
    const [row] = await executorOf(this.database).select().from(delegations).where(eq(delegations.id, id));

    return row === undefined ? undefined : DelegationMapper.toDomain(row);
  }

  async findUnendedTo(organisationId: string, delegateId: string): Promise<readonly Delegation[]> {
    const lentTo = and(unended(organisationId), eq(delegations.delegateId, delegateId));
    const rows = await executorOf(this.database).select().from(delegations).where(lentTo).orderBy(delegations.id);

    return rows.map((row) => DelegationMapper.toDomain(row));
  }

  async findUnendedInvolving(organisationId: string, accountId: string): Promise<readonly Delegation[]> {
    const either = or(eq(delegations.delegatorId, accountId), eq(delegations.delegateId, accountId));
    const rows = await executorOf(this.database).select().from(delegations).where(and(unended(organisationId), either)).orderBy(delegations.id);

    return rows.map((row) => DelegationMapper.toDomain(row));
  }

  async save(saved: Delegation): Promise<void> {
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...DelegationMapper.toRow(saved), version: next };
      const written = expected === 0 ? await this.insert(state) : await this.update(state, expected);

      return written.length;
    });
  }

  private insert(state: VersionedDelegation) {
    const row = { ...state, ...stampCreation(this.scope, this.clock) };

    return executorOf(this.database)
      .insert(delegations)
      .values(row)
      .onConflictDoNothing({ target: primaryKeyOf(delegations) })
      .returning({ id: delegations.id });
  }

  private update(state: VersionedDelegation, expected: number) {
    const sameVersion = and(eq(delegations.id, state.id), eq(delegations.version, expected));

    return executorOf(this.database)
      .update(delegations)
      .set({ ...state, ...stampUpdate(this.scope, this.clock) })
      .where(sameVersion)
      .returning({ id: delegations.id });
  }
}

function unended(organisationId: string) {
  return and(eq(delegations.organisationId, organisationId), isNull(delegations.endedAt));
}

/** The executor of the unit of work, which every statement of this file goes through. */
function executorOf(database: Database): ReturnType<Database['executor']> {
  return database.executor();
}
