import { pageOf, type PageRequest } from '@ddd-ts-kit/kernel';
import type { SearchMembersReader } from '{{alias.context}}/application/ports/search-members-reader.port{{alias.ext}}';
import type {
  SearchMembersItem,
  SearchMembersResult,
  SearchMembersSort,
} from '{{alias.context}}/application/queries/search-members/search-members.result{{alias.ext}}';

/** The members a spec gives it, by organisation, read back in the order they joined. */
export class FakeSearchMembersReader implements SearchMembersReader {
  private readonly members = new Map<string, SearchMembersItem[]>();

  given(organisationId: string, ...members: readonly SearchMembersItem[]): this {
    this.members.set(organisationId, [...(this.members.get(organisationId) ?? []), ...members]);

    return this;
  }

  async search(organisationId: string, page: PageRequest<SearchMembersSort>): Promise<SearchMembersResult> {
    const all = this.members.get(organisationId) ?? [];
    const offset = page.kind === 'offset' ? page.offset : 0;

    return pageOf(all.slice(offset, offset + page.limit), { total: all.length });
  }
}
