import { type EntityManager } from 'typeorm';
import { stampCreation, stampUpdate, type Clock, type ExecutionScope } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Repository } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
import { type TypeOrmContext, insertIgnoringConflict, optimisticUpdate } from '@ddd-ts-kit/typeorm';
import type { Invitation } from '{{alias.context}}/domain/aggregates/invitation.aggregate{{alias.ext}}';
{{#if style.declared}}
import { InvitationRepository } from '{{alias.context}}/domain/repositories/invitation.repository{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import type { InvitationRepository } from '{{alias.context}}/domain/repositories/invitation.repository{{alias.ext}}';
{{/unless}}
import { invitations } from '{{alias.context}}/infrastructure/persistence/{{context.kebab}}.schema{{alias.ext}}';
import { InvitationMapper } from '{{alias.context}}/infrastructure/persistence/invitation.mapper{{alias.ext}}';
import type { InvitationColumns } from '{{alias.context}}/infrastructure/persistence/invitation-row.schema{{alias.ext}}';

type VersionedInvitation = InvitationColumns & { version: number };

{{#if style.declared}}
@Repository(InvitationRepository)
{{/if}}
export class TypeOrmInvitationRepository implements InvitationRepository {
  constructor(
    private readonly database: TypeOrmContext,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Invitation | undefined> {
    const row = await managerOf(this.database).findOneBy(invitations, { id });

    return row === null ? undefined : InvitationMapper.toDomain(row);
  }

  async findByTokenHash(tokenHash: string): Promise<Invitation | undefined> {
    const row = await managerOf(this.database).findOneBy(invitations, { tokenHash });

    return row === null ? undefined : InvitationMapper.toDomain(row);
  }

  async save(saved: Invitation): Promise<void> {
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...InvitationMapper.toRow(saved), version: next };

      return expected === 0 ? this.insert(state) : this.update(state, expected);
    });
  }

  private async insert(state: VersionedInvitation): Promise<number> {
    const row = { ...state, ...stampCreation(this.scope, this.clock) };

    return (await insertIgnoringConflict(managerOf(this.database), invitations, row)) ? 1 : 0;
  }

  private async update(state: VersionedInvitation, expected: number): Promise<number> {
    const row = { ...state, ...stampUpdate(this.scope, this.clock) };

    const updated = await managerOf(this.database).update(invitations, { id: state.id, version: expected }, row);

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
