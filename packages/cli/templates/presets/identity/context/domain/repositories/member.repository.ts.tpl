import { Repository } from '@ddd-ts-kit/kernel';
import type { Member } from '{{alias.context}}/domain/aggregates/member.aggregate{{alias.ext}}';

export abstract class MemberRepository extends Repository<Member> {
  /** The current membership of an account in an organisation: there is at most one. */
  abstract findOf(organisationId: string, accountId: string): Promise<Member | undefined>;

  /** The current memberships of an account, in every organisation. */
  abstract searchCurrentOf(accountId: string): Promise<readonly Member[]>;

  /** How many current members of the organisation are owners. */
  abstract countOwners(organisationId: string): Promise<number>;
}
