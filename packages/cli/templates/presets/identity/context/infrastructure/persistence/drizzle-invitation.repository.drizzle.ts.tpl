import { and, eq } from 'drizzle-orm';
import { optimisticUpdate } from '@ddd-ts-kit/drizzle/postgres';
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
import { invitations } from '{{alias.context}}/infrastructure/persistence/{{context.kebab}}.schema{{alias.ext}}';
import { InvitationMapper, type InvitationColumns } from '{{alias.context}}/infrastructure/persistence/invitation.mapper{{alias.ext}}';

type VersionedInvitation = InvitationColumns & { readonly version: number };

{{#if style.declared}}
@Repository(InvitationRepository)
{{/if}}
export class DrizzleInvitationRepository implements InvitationRepository {
  constructor(
    private readonly database: Database,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Invitation | undefined> {
    const [row] = await executorOf(this.database).select().from(invitations).where(eq(invitations.id, id));

    return row === undefined ? undefined : InvitationMapper.toDomain(row);
  }

  async findByTokenHash(tokenHash: string): Promise<Invitation | undefined> {
    const [row] = await executorOf(this.database).select().from(invitations).where(eq(invitations.tokenHash, tokenHash));

    return row === undefined ? undefined : InvitationMapper.toDomain(row);
  }

  async save(saved: Invitation): Promise<void> {
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...InvitationMapper.toRow(saved), version: next };
      const written = expected === 0 ? await this.insert(state) : await this.update(state, expected);

      return written.length;
    });
  }

  private insert(state: VersionedInvitation) {
    const row = { ...state, ...stampCreation(this.scope, this.clock) };

    return executorOf(this.database).insert(invitations).values(row).onConflictDoNothing().returning({ id: invitations.id });
  }

  private update(state: VersionedInvitation, expected: number) {
    const sameVersion = and(eq(invitations.id, state.id), eq(invitations.version, expected));

    return executorOf(this.database)
      .update(invitations)
      .set({ ...state, ...stampUpdate(this.scope, this.clock) })
      .where(sameVersion)
      .returning({ id: invitations.id });
  }
}

/** The executor of the unit of work, which every statement of this file goes through. */
function executorOf(database: Database): ReturnType<Database['executor']> {
{{#if tenancy.any}}
  // ddd-ts-kit-disable-next-line tenancy/scoped-statement -- {{preset.adr}}: the {{context.kebab}} context is the control plane of the tenants, and its rows belong to none of them.
{{/if}}
  return database.executor();
}
