import { optimisticUpdate } from '@ddd-ts-kit/prisma';
import { stampCreation, stampUpdate, type Clock, type ExecutionScope } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Repository } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
import type { Invitation } from '{{alias.context}}/domain/aggregates/invitation.aggregate{{alias.ext}}';
{{#if style.declared}}
import { InvitationRepository } from '{{alias.context}}/domain/repositories/invitation.repository{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import type { InvitationRepository } from '{{alias.context}}/domain/repositories/invitation.repository{{alias.ext}}';
{{/unless}}
import type { Database } from '{{alias.platform}}/database/database{{alias.ext}}';
import { InvitationMapper, type InvitationColumns } from '{{alias.context}}/infrastructure/persistence/invitation.mapper{{alias.ext}}';

type VersionedInvitation = InvitationColumns & { readonly version: number };

{{#if style.declared}}
@Repository(InvitationRepository)
{{/if}}
export class PrismaInvitationRepository implements InvitationRepository {
  constructor(
    private readonly database: Database,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Invitation | undefined> {
    const row = await invitationsOf(this.database).findUnique({ where: { id } });

    return row === null ? undefined : InvitationMapper.toDomain(row);
  }

  async findByTokenHash(tokenHash: string): Promise<Invitation | undefined> {
    const row = await invitationsOf(this.database).findUnique({ where: { tokenHash } });

    return row === null ? undefined : InvitationMapper.toDomain(row);
  }

  async save(saved: Invitation): Promise<void> {
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...InvitationMapper.toRow(saved), version: next };
      const written = expected === 0 ? await this.insert(state) : await this.update(state, expected);

      return written.count;
    });
  }

  private insert(state: VersionedInvitation): Promise<{ count: number }> {
    const row = { ...state, ...stampCreation(this.scope, this.clock) };

    return invitationsOf(this.database).createMany({ data: [row], skipDuplicates: true });
  }

  private update(state: VersionedInvitation, expected: number): Promise<{ count: number }> {
    return invitationsOf(this.database).updateMany({
      where: { id: state.id, version: expected },
      data: { ...state, ...stampUpdate(this.scope, this.clock) },
    });
  }
}

/** The invitations on the client of the unit of work, which every statement of this file goes through. */
function invitationsOf(database: Database): ReturnType<Database['client']>['{{context.camel}}Invitation'] {
{{#if tenancy.any}}
  // ddd-ts-kit-disable-next-line tenancy/scoped-statement -- {{preset.adr}}: the {{context.kebab}} context is the control plane of the tenants, and its rows belong to none of them.
{{/if}}
  return database.client().{{context.camel}}Invitation;
}
