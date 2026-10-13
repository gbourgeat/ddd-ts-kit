import { ValueObject } from '@ddd-ts-kit/kernel';
import type { MemberRight } from '{{alias.context}}/domain/vocabularies/member-right.vocabulary{{alias.ext}}';

export type OrganisationRightsProps = {
  readonly organisationId: string;
  readonly accountId: string;
  readonly rights: readonly MemberRight[];
};

/**
 * What one account may do in one organisation at one instant: the rights of its role, and those
 * an active delegation lends it. The policies of the context decide on it; the platform authorizer
 * is asked about the resource it names, the context, as for every use case of the context.
 */
export class OrganisationRights extends ValueObject<OrganisationRightsProps> {
  readonly type = 'context';

  readonly id = '{{context.kebab}}';

  private constructor(props: OrganisationRightsProps) {
    super(props);
  }

  static of(organisationId: string, accountId: string, rights: readonly MemberRight[]): OrganisationRights {
    return new OrganisationRights({ organisationId, accountId, rights: [...new Set(rights)].sort() });
  }

  includes(right: MemberRight): boolean {
    return this.props.rights.includes(right);
  }

  get organisationId(): string {
    return this.props.organisationId;
  }

  get accountId(): string {
    return this.props.accountId;
  }

  get rights(): readonly MemberRight[] {
    return this.props.rights;
  }
}
