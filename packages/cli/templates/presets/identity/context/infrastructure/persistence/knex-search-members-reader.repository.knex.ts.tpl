import type { Knex } from 'knex';
import { InvalidPageRequestError, pageOf, type PageRequest } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Repository } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
import type { KnexContext } from '@ddd-ts-kit/knex';
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
import { {{context.constant}}_SCHEMA } from '{{alias.context}}/infrastructure/persistence/{{context.kebab}}.schema{{alias.ext}}';
import type { MemberRow } from '{{alias.context}}/infrastructure/persistence/member-row.schema{{alias.ext}}';

interface MemberLine extends Pick<MemberRow, 'id' | 'account_id' | 'role' | 'joined_at'> {
  readonly display_name: string;
  readonly email: string;
}

const COLUMNS = [
  'members.id',
  'members.account_id',
  'members.role',
  'members.joined_at',
  'accounts.display_name',
  'accounts.email',
];

/** The current members of an organisation joined to the profile of their account: one statement, the page applied by the database. */
{{#if style.declared}}
@Repository(SearchMembersReader)
{{/if}}
export class KnexSearchMembersReader implements SearchMembersReader {
  constructor(private readonly database: KnexContext) {}

  async search(organisationId: string, page: PageRequest<SearchMembersSort>): Promise<SearchMembersResult> {
    if (page.kind !== 'offset') {
      throw new InvalidPageRequestError('The members of an organisation are read by offset');
    }

    const direction = page.sort[0]?.direction ?? 'asc';
    const current = { 'members.organisation_id': organisationId, 'members.removed_at': null };

    const rows = await membersOf(this.database)
      .select<MemberLine[]>(COLUMNS)
      .join('accounts', 'accounts.id', 'members.account_id')
      .where(current)
      .orderBy([
        { column: 'members.joined_at', order: direction },
        { column: 'members.id', order: direction },
      ])
      .limit(page.limit)
      .offset(page.offset);

    const counted = await membersOf(this.database).where(current).count<{ total: string | number }[]>({ total: '*' }).first();

    return pageOf(rows.map(toItem), { total: Number(counted?.total ?? 0) });
  }
}

/** A function and not a method: a query builder is thenable, and a method that answers one is read as asynchronous by whatever wraps the adapter (tracing), which then answers a promise. */
function membersOf(database: KnexContext): Knex.QueryBuilder<MemberLine, MemberLine[]> {
{{#if tenancy.any}}
  // ddd-ts-kit-disable-next-line tenancy/scoped-statement -- {{preset.adr}}: the {{context.kebab}} context is the control plane of the tenants, and its rows belong to none of them.
{{/if}}
  const members = database.executor()<MemberLine, MemberLine[]>('members');

  return members.withSchema({{context.constant}}_SCHEMA);
}

function toItem(line: MemberLine): SearchMembersItem {
  return {
    memberId: line.id,
    accountId: line.account_id,
    displayName: line.display_name,
    email: line.email,
    role: line.role,
    joinedAt: line.joined_at,
  };
}
