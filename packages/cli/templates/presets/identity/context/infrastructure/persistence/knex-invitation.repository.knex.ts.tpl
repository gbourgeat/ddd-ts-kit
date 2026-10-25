import type { Knex } from 'knex';
import { stampCreation, stampUpdate, type Clock, type ExecutionScope } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Repository } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
import { type KnexContext, auditRow, insertIgnoringConflict, optimisticUpdate } from '@ddd-ts-kit/knex';
import type { Invitation } from '{{alias.context}}/domain/aggregates/invitation.aggregate{{alias.ext}}';
{{#if style.declared}}
import { InvitationRepository } from '{{alias.context}}/domain/repositories/invitation.repository{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import type { InvitationRepository } from '{{alias.context}}/domain/repositories/invitation.repository{{alias.ext}}';
{{/unless}}
import { {{context.constant}}_SCHEMA } from '{{alias.context}}/infrastructure/persistence/{{context.kebab}}.schema{{alias.ext}}';
import { InvitationMapper } from '{{alias.context}}/infrastructure/persistence/invitation.mapper{{alias.ext}}';
import type { InvitationColumns, InvitationRow } from '{{alias.context}}/infrastructure/persistence/invitation-row.schema{{alias.ext}}';

type VersionedInvitation = InvitationColumns & { readonly version: number };

{{#if style.declared}}
@Repository(InvitationRepository)
{{/if}}
export class KnexInvitationRepository implements InvitationRepository {
  constructor(
    private readonly database: KnexContext,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Invitation | undefined> {
    const row = await tableOf(this.database).where({ id }).first();

    return row === undefined ? undefined : InvitationMapper.toDomain(row);
  }

  async findByTokenHash(tokenHash: string): Promise<Invitation | undefined> {
    const row = await tableOf(this.database).where({ token_hash: tokenHash }).first();

    return row === undefined ? undefined : InvitationMapper.toDomain(row);
  }

  async save(saved: Invitation): Promise<void> {
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...InvitationMapper.toRow(saved), version: next };

      return expected === 0 ? this.insert(state) : this.update(state, expected);
    });
  }

  private async insert(state: VersionedInvitation): Promise<number> {
    const row = { ...state, ...auditRow(stampCreation(this.scope, this.clock)) };

    const inserted = await insertIgnoringConflict(this.database.executor(), tableOf(this.database), {
      row,
      conflict: 'id',
    });

    return inserted ? 1 : 0;
  }

  private async update(state: VersionedInvitation, expected: number): Promise<number> {
    return tableOf(this.database)
      .where({ id: state.id, version: expected })
      .update({ ...state, ...auditRow(stampUpdate(this.scope, this.clock)) });
  }
}

/** A function and not a method: a query builder is thenable, and a method that answers one is read as asynchronous by whatever wraps the adapter (tracing), which then answers a promise. */
function tableOf(database: KnexContext): Knex.QueryBuilder<InvitationRow, InvitationRow[]> {
{{#if tenancy.any}}
  // ddd-ts-kit-disable-next-line tenancy/scoped-statement -- {{preset.adr}}: the {{context.kebab}} context is the control plane of the tenants, and its rows belong to none of them.
{{/if}}
  const table = database.executor()<InvitationRow, InvitationRow[]>('invitations');

  return table.withSchema({{context.constant}}_SCHEMA);
}
