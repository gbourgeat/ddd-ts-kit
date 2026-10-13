import type { PageRequest } from '@ddd-ts-kit/kernel';
import type {
  SearchMembersResult,
  SearchMembersSort,
} from '{{alias.context}}/application/queries/search-members/search-members.result{{alias.ext}}';

export abstract class SearchMembersReader {
  /** One page of the current members of an organisation, with the profile of their account, by the instant they joined then by id. */
  abstract search(organisationId: string, page: PageRequest<SearchMembersSort>): Promise<SearchMembersResult>;
}
