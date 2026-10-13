import { Builder, sequence, type Defaults } from '@ddd-ts-kit/testing';
import { Member } from '{{alias.context}}/domain/aggregates/member.aggregate{{alias.ext}}';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';

interface MemberIngredients {
  readonly id: string;
  readonly organisationId: string;
  readonly accountId: string;
  readonly role: MemberRole;
  readonly joinedAt: Date;
  readonly removedAt: Date | undefined;
}

export class MemberBuilder extends Builder<MemberIngredients, Member> {
  identifiedBy(id: string): this {
    return this.with('id', id);
  }

  of(organisationId: string, accountId: string): this {
    return this.with('organisationId', organisationId).with('accountId', accountId);
  }

  as(role: MemberRole): this {
    return this.with('role', role);
  }

  joinedOn(instant: Date): this {
    return this.with('joinedAt', instant);
  }

  removedAt(instant: Date): this {
    return this.with('removedAt', instant);
  }

  protected defaults(): Defaults<MemberIngredients> {
    return {
      id: sequence('member'),
      organisationId: 'acme',
      accountId: sequence('account'),
      role: MemberRole.Member,
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
      removedAt: undefined,
    };
  }

  protected construct({ id, organisationId, accountId, role, joinedAt, removedAt }: MemberIngredients): Member {
    const member = Member.join(id, { organisationId, accountId, role }, joinedAt);

    if (removedAt !== undefined) {
      member.remove({ by: MemberRole.Owner, owners: 2 }, removedAt);
    }

    return member;
  }
}

export function aMember(): MemberBuilder {
  return new MemberBuilder();
}
