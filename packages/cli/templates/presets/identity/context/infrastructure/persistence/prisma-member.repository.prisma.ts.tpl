import { optimisticUpdate, rowsCreated } from '@ddd-ts-kit/prisma';
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
import { MemberMapper, type MemberColumns } from '{{alias.context}}/infrastructure/persistence/member.mapper{{alias.ext}}';

type VersionedMember = MemberColumns & { readonly version: number };

{{#if style.declared}}
@Repository(MemberRepository)
{{/if}}
export class PrismaMemberRepository implements MemberRepository {
  constructor(
    private readonly database: Database,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Member | undefined> {
    const row = await membersOf(this.database).findUnique({ where: { id } });

    return row === null ? undefined : MemberMapper.toDomain(row);
  }

  async findOf(organisationId: string, accountId: string): Promise<Member | undefined> {
    const row = await membersOf(this.database).findFirst({ where: { organisationId, accountId, removedAt: null } });

    return row === null ? undefined : MemberMapper.toDomain(row);
  }

  async searchCurrentOf(accountId: string): Promise<readonly Member[]> {
    const rows = await membersOf(this.database).findMany({ where: { accountId, removedAt: null }, orderBy: { id: 'asc' } });

    return rows.map((row) => MemberMapper.toDomain(row));
  }

  countOwners(organisationId: string): Promise<number> {
    return membersOf(this.database).count({ where: { organisationId, role: MemberRole.Owner, removedAt: null } });
  }

  async save(saved: Member): Promise<void> {
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...MemberMapper.toRow(saved), version: next };

      return expected === 0 ? this.insert(state) : (await this.update(state, expected)).count;
    });
  }

  /** `skipDuplicates` skips a row that takes any unique value: `rowsCreated` tells a taken id from another value. */
  private async insert(state: VersionedMember): Promise<number> {
    const row = { ...state, ...stampCreation(this.scope, this.clock) };
    const created = await membersOf(this.database).createMany({ data: [row], skipDuplicates: true });

    return rowsCreated(created, {
      id: state.id,
      holders: () => membersOf(this.database).count({ where: { id: state.id } }),
    });
  }

  private update(state: VersionedMember, expected: number): Promise<{ count: number }> {
    return membersOf(this.database).updateMany({
      where: { id: state.id, version: expected },
      data: { ...state, ...stampUpdate(this.scope, this.clock) },
    });
  }
}

/** The members on the client of the unit of work, which every statement of this file goes through. */
function membersOf(database: Database): ReturnType<Database['client']>['{{context.camel}}Member'] {
  return database.client().{{context.camel}}Member;
}
