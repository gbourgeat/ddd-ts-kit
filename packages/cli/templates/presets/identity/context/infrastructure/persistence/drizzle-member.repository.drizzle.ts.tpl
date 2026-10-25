import { and, count, eq, isNull } from 'drizzle-orm';
import { optimisticUpdate } from '@ddd-ts-kit/drizzle/postgres';
import { stampCreation, stampUpdate, type Clock, type ExecutionScope } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Repository } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
import type { Member } from '{{alias.context}}/domain/aggregates/member.aggregate{{alias.ext}}';
{{#if style.declared}}
import { MemberRepository } from '{{alias.context}}/domain/repositories/member.repository{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import type { MemberRepository } from '{{alias.context}}/domain/repositories/member.repository{{alias.ext}}';
{{/unless}}
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';
import type { Database } from '{{alias.platform}}/database/database{{alias.ext}}';
import { members } from '{{alias.context}}/infrastructure/persistence/{{context.kebab}}.schema{{alias.ext}}';
import { MemberMapper, type MemberColumns } from '{{alias.context}}/infrastructure/persistence/member.mapper{{alias.ext}}';

type VersionedMember = MemberColumns & { readonly version: number };

{{#if style.declared}}
@Repository(MemberRepository)
{{/if}}
export class DrizzleMemberRepository implements MemberRepository {
  constructor(
    private readonly database: Database,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Member | undefined> {
    const [row] = await executorOf(this.database).select().from(members).where(eq(members.id, id));

    return row === undefined ? undefined : MemberMapper.toDomain(row);
  }

  async findOf(organisationId: string, accountId: string): Promise<Member | undefined> {
    const [row] = await executorOf(this.database).select().from(members).where(current(organisationId, accountId));

    return row === undefined ? undefined : MemberMapper.toDomain(row);
  }

  async searchCurrentOf(accountId: string): Promise<readonly Member[]> {
    const ofAccount = and(eq(members.accountId, accountId), isNull(members.removedAt));
    const rows = await executorOf(this.database).select().from(members).where(ofAccount).orderBy(members.id);

    return rows.map((row) => MemberMapper.toDomain(row));
  }

  async countOwners(organisationId: string): Promise<number> {
    const owners = and(eq(members.organisationId, organisationId), eq(members.role, MemberRole.Owner), isNull(members.removedAt));
    const [counted] = await executorOf(this.database).select({ total: count() }).from(members).where(owners);

    return counted?.total ?? 0;
  }

  async save(saved: Member): Promise<void> {
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...MemberMapper.toRow(saved), version: next };
      const written = expected === 0 ? await this.insert(state) : await this.update(state, expected);

      return written.length;
    });
  }

  private insert(state: VersionedMember) {
    const row = { ...state, ...stampCreation(this.scope, this.clock) };

    return executorOf(this.database).insert(members).values(row).onConflictDoNothing().returning({ id: members.id });
  }

  private update(state: VersionedMember, expected: number) {
    const sameVersion = and(eq(members.id, state.id), eq(members.version, expected));

    return executorOf(this.database)
      .update(members)
      .set({ ...state, ...stampUpdate(this.scope, this.clock) })
      .where(sameVersion)
      .returning({ id: members.id });
  }
}

function current(organisationId: string, accountId: string) {
  return and(eq(members.organisationId, organisationId), eq(members.accountId, accountId), isNull(members.removedAt));
}

/** The executor of the unit of work, which every statement of this file goes through. */
function executorOf(database: Database): ReturnType<Database['executor']> {
{{#if tenancy.any}}
  // ddd-ts-kit-disable-next-line tenancy/scoped-statement -- {{preset.adr}}: the {{context.kebab}} context is the control plane of the tenants, and its rows belong to none of them.
{{/if}}
  return database.executor();
}
