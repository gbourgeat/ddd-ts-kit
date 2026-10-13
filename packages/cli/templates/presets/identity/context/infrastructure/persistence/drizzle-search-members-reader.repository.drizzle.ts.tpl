import { and, asc, count, desc, eq, isNull } from 'drizzle-orm';
import { InvalidPageRequestError, pageOf, type PageRequest } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { SearchMembersReader } from '{{alias.context}}/application/ports/search-members-reader.port{{alias.ext}}';
import type {
  SearchMembersResult,
  SearchMembersSort,
} from '{{alias.context}}/application/queries/search-members/search-members.result{{alias.ext}}';
import type { Database } from '{{alias.platform}}/database/database{{alias.ext}}';
import { accounts, members } from '{{alias.context}}/infrastructure/persistence/{{context.kebab}}.schema{{alias.ext}}';

/** The current members of an organisation joined to the profile of their account: one statement, the page applied by the database. */
@Repository(SearchMembersReader)
export class DrizzleSearchMembersReader implements SearchMembersReader {
  constructor(private readonly database: Database) {}

  async search(organisationId: string, page: PageRequest<SearchMembersSort>): Promise<SearchMembersResult> {
    if (page.kind !== 'offset') {
      throw new InvalidPageRequestError('The members of an organisation are read by offset');
    }

    const order = page.sort[0]?.direction === 'desc' ? desc : asc;
    const current = and(eq(members.organisationId, organisationId), isNull(members.removedAt));

    const currentMembers = await executorOf(this.database)
      .select({
        memberId: members.id,
        accountId: members.accountId,
        displayName: accounts.displayName,
        email: accounts.email,
        role: members.role,
        joinedAt: members.joinedAt,
      })
      .from(members)
      .innerJoin(accounts, eq(accounts.id, members.accountId))
      .where(current)
      .orderBy(order(members.joinedAt), order(members.id))
      .limit(page.limit)
      .offset(page.offset);

    const [counted] = await executorOf(this.database).select({ total: count() }).from(members).where(current);

    return pageOf(currentMembers, { total: counted?.total ?? 0 });
  }
}

/** The executor of the unit of work, which every statement of this file goes through. */
function executorOf(database: Database): ReturnType<Database['executor']> {
{{#if tenancy.any}}
  // ddd-ts-kit-disable-next-line tenancy/scoped-statement -- {{preset.adr}}: the {{context.kebab}} context is the control plane of the tenants, and its rows belong to none of them.
{{/if}}
  return database.executor();
}
