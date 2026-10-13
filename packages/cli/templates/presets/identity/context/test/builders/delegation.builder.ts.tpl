import { Builder, sequence, type Defaults } from '@ddd-ts-kit/testing';
import { Delegation } from '{{alias.context}}/domain/aggregates/delegation.aggregate{{alias.ext}}';
import { DelegationPeriod } from '{{alias.context}}/domain/value-objects/delegation-period.vo{{alias.ext}}';
import { OrganisationRights } from '{{alias.context}}/domain/value-objects/organisation-rights.vo{{alias.ext}}';
import { MemberRight } from '{{alias.context}}/domain/vocabularies/member-right.vocabulary{{alias.ext}}';

interface DelegationIngredients {
  readonly id: string;
  readonly organisationId: string;
  readonly delegatorId: string;
  readonly delegateId: string;
  readonly rights: readonly MemberRight[];
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly grantedAt: Date;
}

export class DelegationBuilder extends Builder<DelegationIngredients, Delegation> {
  identifiedBy(id: string): this {
    return this.with('id', id);
  }

  in(organisationId: string): this {
    return this.with('organisationId', organisationId);
  }

  from(delegatorId: string): this {
    return this.with('delegatorId', delegatorId);
  }

  to(delegateId: string): this {
    return this.with('delegateId', delegateId);
  }

  lending(...rights: readonly MemberRight[]): this {
    return this.with('rights', rights);
  }

  between(startsAt: Date, endsAt: Date): this {
    return this.with('startsAt', startsAt).with('endsAt', endsAt);
  }

  protected defaults(): Defaults<DelegationIngredients> {
    return {
      id: sequence('delegation'),
      organisationId: 'acme',
      delegatorId: 'account-owner',
      delegateId: 'account-deputy',
      rights: [MemberRight.InviteMembers],
      startsAt: new Date('2026-01-01T00:00:00.000Z'),
      endsAt: new Date('2026-01-31T00:00:00.000Z'),
      grantedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
  }

  protected construct(ingredients: DelegationIngredients): Delegation {
    const { id, organisationId, delegatorId, delegateId, rights } = ingredients;
    const period = DelegationPeriod.create(ingredients.startsAt, ingredients.endsAt);
    const held = OrganisationRights.of(organisationId, delegatorId, Object.values(MemberRight));

    return Delegation.grant(id, { organisationId, delegatorId, delegateId, rights, period, held }, ingredients.grantedAt);
  }
}

export function aDelegation(): DelegationBuilder {
  return new DelegationBuilder();
}
