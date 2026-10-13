import type { Knex } from 'knex';
import { stampCreation, stampUpdate, type Clock, type ExecutionScope } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { type KnexContext, auditRow, insertIgnoringConflict, optimisticUpdate } from '@ddd-ts-kit/knex';
import type { Member } from '{{alias.context}}/domain/aggregates/member.aggregate{{alias.ext}}';
import { MemberRepository } from '{{alias.context}}/domain/repositories/member.repository{{alias.ext}}';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';
import { {{context.constant}}_SCHEMA } from '{{alias.context}}/infrastructure/persistence/{{context.kebab}}.schema{{alias.ext}}';
import { MemberMapper } from '{{alias.context}}/infrastructure/persistence/member.mapper{{alias.ext}}';
import type { MemberColumns, MemberRow } from '{{alias.context}}/infrastructure/persistence/member-row.schema{{alias.ext}}';

type VersionedMember = MemberColumns & { readonly version: number };

@Repository(MemberRepository)
export class KnexMemberRepository implements MemberRepository {
  constructor(
    private readonly database: KnexContext,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Member | undefined> {
    const row = await tableOf(this.database).where({ id }).first();

    return row === undefined ? undefined : MemberMapper.toDomain(row);
  }

  async findOf(organisationId: string, accountId: string): Promise<Member | undefined> {
    const current = { organisation_id: organisationId, account_id: accountId };
    const row = await tableOf(this.database).where(current).whereNull('removed_at').first();

    return row === undefined ? undefined : MemberMapper.toDomain(row);
  }

  async searchCurrentOf(accountId: string): Promise<readonly Member[]> {
    const rows = await tableOf(this.database).where({ account_id: accountId }).whereNull('removed_at').orderBy('id');

    return rows.map((row) => MemberMapper.toDomain(row));
  }

  async countOwners(organisationId: string): Promise<number> {
    const owners = { organisation_id: organisationId, role: MemberRole.Owner };
    const counted = await tableOf(this.database).where(owners).whereNull('removed_at').count({ total: '*' }).first();

    return Number(counted?.total ?? 0);
  }

  async save(saved: Member): Promise<void> {
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...MemberMapper.toRow(saved), version: next };

      return expected === 0 ? this.insert(state) : this.update(state, expected);
    });
  }

  private async insert(state: VersionedMember): Promise<number> {
    const row = { ...state, ...auditRow(stampCreation(this.scope, this.clock)) };

    const inserted = await insertIgnoringConflict(this.database.executor(), tableOf(this.database), {
      row,
      conflict: 'id',
    });

    return inserted ? 1 : 0;
  }

  private async update(state: VersionedMember, expected: number): Promise<number> {
    return tableOf(this.database)
      .where({ id: state.id, version: expected })
      .update({ ...state, ...auditRow(stampUpdate(this.scope, this.clock)) });
  }
}

/** A function and not a method: a query builder is thenable, and a method that answers one is read as asynchronous by whatever wraps the adapter (tracing), which then answers a promise. */
function tableOf(database: KnexContext): Knex.QueryBuilder<MemberRow, MemberRow[]> {
{{#if tenancy.any}}
  // ddd-ts-kit-disable-next-line tenancy/scoped-statement -- {{preset.adr}}: the {{context.kebab}} context is the control plane of the tenants, and its rows belong to none of them.
{{/if}}
  const table = database.executor()<MemberRow, MemberRow[]>('members');

  return table.withSchema({{context.constant}}_SCHEMA);
}
