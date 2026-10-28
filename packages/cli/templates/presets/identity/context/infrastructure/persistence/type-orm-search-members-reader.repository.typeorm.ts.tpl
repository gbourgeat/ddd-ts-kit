import { In, IsNull, type EntityManager } from 'typeorm';
import { InvalidPageRequestError, pageOf, type PageRequest } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Repository } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
import type { TypeOrmContext } from '@ddd-ts-kit/typeorm';
{{#if style.declared}}
import { SearchMembersReader } from '{{alias.context}}/application/ports/search-members-reader.port{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import type { SearchMembersReader } from '{{alias.context}}/application/ports/search-members-reader.port{{alias.ext}}';
{{/unless}}
import type {
  SearchMembersItem,
  SearchMembersResult,
  SearchMembersSort,
} from '{{alias.context}}/application/queries/search-members/search-members.result{{alias.ext}}';
import type { AccountRow } from '{{alias.context}}/infrastructure/persistence/account-row.schema{{alias.ext}}';
import type { MemberRow } from '{{alias.context}}/infrastructure/persistence/member-row.schema{{alias.ext}}';
import { accounts, members } from '{{alias.context}}/infrastructure/persistence/{{context.kebab}}.schema{{alias.ext}}';

/**
 * The current members of an organisation with the profile of their account: the page applied by
 * the database, then the accounts of that page read in one statement, since the entities of the
 * context hold no relation.
 */
{{#if style.declared}}
@Repository(SearchMembersReader)
{{/if}}
export class TypeOrmSearchMembersReader implements SearchMembersReader {
  constructor(private readonly database: TypeOrmContext) {}

  async search(organisationId: string, page: PageRequest<SearchMembersSort>): Promise<SearchMembersResult> {
    if (page.kind !== 'offset') {
      throw new InvalidPageRequestError('The members of an organisation are read by offset');
    }

    const direction = page.sort[0]?.direction === 'desc' ? 'DESC' : 'ASC';
    const manager = managerOf(this.database);
    const current = { organisationId, removedAt: IsNull() };

    const listed = await manager.find(members, {
      where: current,
      order: { joinedAt: direction, id: direction },
      take: page.limit,
      skip: page.offset,
    });

    const profiles = await manager.findBy(accounts, { id: In(listed.map((member) => member.accountId)) });
    const total = await manager.countBy(members, current);

    return pageOf(withProfiles(listed, profiles), { total });
  }
}

/** Each member of the page with the profile of its account, in the order of the page. */
function withProfiles(members: readonly MemberRow[], accounts: readonly AccountRow[]): SearchMembersItem[] {
  return members.flatMap((member) => {
    const account = accounts.find((candidate) => candidate.id === member.accountId);

    return account === undefined
      ? []
      : [
          {
            memberId: member.id,
            accountId: member.accountId,
            displayName: account.displayName,
            email: account.email,
            role: member.role,
            joinedAt: member.joinedAt,
          },
        ];
  });
}

/** The manager of the unit of work, which every statement of this file goes through. */
function managerOf(database: TypeOrmContext): EntityManager {
{{#if tenancy.any}}
  // ddd-ts-kit-disable-next-line tenancy/scoped-statement -- {{preset.adr}}: the {{context.kebab}} context is the control plane of the tenants, and its rows belong to none of them.
{{/if}}
  return database.manager();
}
