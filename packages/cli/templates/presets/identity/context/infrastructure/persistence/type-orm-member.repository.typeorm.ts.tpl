import { IsNull, type EntityManager } from 'typeorm';
import { stampCreation, stampUpdate, type Clock, type ExecutionScope } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Repository } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
import { type TypeOrmContext, insertIgnoringConflict, optimisticUpdate } from '@ddd-ts-kit/typeorm';
import type { Member } from '{{alias.context}}/domain/aggregates/member.aggregate{{alias.ext}}';
{{#if style.declared}}
import { MemberRepository } from '{{alias.context}}/domain/repositories/member.repository{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import type { MemberRepository } from '{{alias.context}}/domain/repositories/member.repository{{alias.ext}}';
{{/unless}}
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';
import { members } from '{{alias.context}}/infrastructure/persistence/{{context.kebab}}.schema{{alias.ext}}';
import { MemberMapper } from '{{alias.context}}/infrastructure/persistence/member.mapper{{alias.ext}}';
import type { MemberColumns } from '{{alias.context}}/infrastructure/persistence/member-row.schema{{alias.ext}}';

type VersionedMember = MemberColumns & { version: number };

{{#if style.declared}}
@Repository(MemberRepository)
{{/if}}
export class TypeOrmMemberRepository implements MemberRepository {
  constructor(
    private readonly database: TypeOrmContext,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Member | undefined> {
    const row = await managerOf(this.database).findOneBy(members, { id });

    return row === null ? undefined : MemberMapper.toDomain(row);
  }

  async findOf(organisationId: string, accountId: string): Promise<Member | undefined> {
    const row = await managerOf(this.database).findOneBy(members, { organisationId, accountId, removedAt: IsNull() });

    return row === null ? undefined : MemberMapper.toDomain(row);
  }

  async searchCurrentOf(accountId: string): Promise<readonly Member[]> {
    const rows = await managerOf(this.database).find(members, {
      where: { accountId, removedAt: IsNull() },
      order: { id: 'ASC' },
    });

    return rows.map((row) => MemberMapper.toDomain(row));
  }

  countOwners(organisationId: string): Promise<number> {
    return managerOf(this.database).countBy(members, { organisationId, role: MemberRole.Owner, removedAt: IsNull() });
  }

  async save(saved: Member): Promise<void> {
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...MemberMapper.toRow(saved), version: next };

      return expected === 0 ? this.insert(state) : this.update(state, expected);
    });
  }

  private async insert(state: VersionedMember): Promise<number> {
    const row = { ...state, ...stampCreation(this.scope, this.clock) };

    return (await insertIgnoringConflict(managerOf(this.database), members, row)) ? 1 : 0;
  }

  private async update(state: VersionedMember, expected: number): Promise<number> {
    const row = { ...state, ...stampUpdate(this.scope, this.clock) };

    const updated = await managerOf(this.database).update(members, { id: state.id, version: expected }, row);

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
