import { InvalidPageRequestError, pageOf, type PageRequest } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Repository } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
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
import type { Database } from '{{alias.platform}}/database/database{{alias.ext}}';
import type { {{context.pascal}}Account as AccountRow, {{context.pascal}}Member as MemberRow } from '{{alias.generated}}/prisma/client{{alias.ext}}';

/**
 * The current members of an organisation with the profile of their account: the page applied by
 * the database, then the accounts of that page read in one statement, since the models of the
 * context hold no relation.
 */
{{#if style.declared}}
@Repository(SearchMembersReader)
{{/if}}
export class PrismaSearchMembersReader implements SearchMembersReader {
  constructor(private readonly database: Database) {}

  async search(organisationId: string, page: PageRequest<SearchMembersSort>): Promise<SearchMembersResult> {
    if (page.kind !== 'offset') {
      throw new InvalidPageRequestError('The members of an organisation are read by offset');
    }

    const direction = page.sort[0]?.direction === 'desc' ? 'desc' : 'asc';
    const client = clientOf(this.database);
    const current = { organisationId, removedAt: null };

    const members = await client.{{context.camel}}Member.findMany({
      where: current,
      orderBy: [{ joinedAt: direction }, { id: direction }],
      take: page.limit,
      skip: page.offset,
    });

    const accounts = await client.{{context.camel}}Account.findMany({
      where: { id: { in: members.map((member) => member.accountId) } },
    });

    const total = await client.{{context.camel}}Member.count({ where: current });

    return pageOf(withProfiles(members, accounts), { total });
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

/** The client of the unit of work, which every statement of this file goes through. */
function clientOf(database: Database): ReturnType<Database['client']> {
{{#if tenancy.any}}
  // ddd-ts-kit-disable-next-line tenancy/scoped-statement -- {{preset.adr}}: the {{context.kebab}} context is the control plane of the tenants, and its rows belong to none of them.
{{/if}}
  return database.client();
}
