import type { Page } from '@ddd-ts-kit/kernel';
import type { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';

/** A current member of an organisation, with the profile of their account. */
export interface SearchMembersItem {
  readonly memberId: string;
  readonly accountId: string;
  readonly displayName: string;
  readonly email: string;
  readonly role: MemberRole;
  readonly joinedAt: Date;
}

/** By the instant they joined, earliest first unless the client asks otherwise. */
export type SearchMembersSort = 'joinedAt';

export type SearchMembersResult = Page<SearchMembersItem>;
