import { InMemoryRepository } from '@ddd-ts-kit/testing';
import { Member } from '{{alias.context}}/domain/aggregates/member.aggregate{{alias.ext}}';
import type { MemberRepository } from '{{alias.context}}/domain/repositories/member.repository{{alias.ext}}';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';

export class FakeMemberRepository extends InMemoryRepository<Member> implements MemberRepository {
  constructor() {
    // A copy by rehydration and not a snapshot: a snapshot goes through `structuredClone`, which turns the value objects of the state into plain objects. The state is immutable, so sharing its values between copies is safe.
    super({ clone: (stored: Member) => Member.rehydrate(stored.id, stored.toState()) });
  }

  async findOf(organisationId: string, accountId: string): Promise<Member | undefined> {
    return this.all().find((stored) => stored.isActive && isOf(stored, organisationId, accountId));
  }

  async searchCurrentOf(accountId: string): Promise<readonly Member[]> {
    return this.all().filter((stored) => stored.isActive && stored.accountId === accountId);
  }

  async countOwners(organisationId: string): Promise<number> {
    return this.all().filter(
      (stored) => stored.isActive && stored.organisationId === organisationId && stored.role === MemberRole.Owner,
    ).length;
  }
}

function isOf(member: Member, organisationId: string, accountId: string): boolean {
  return member.organisationId === organisationId && member.accountId === accountId;
}
