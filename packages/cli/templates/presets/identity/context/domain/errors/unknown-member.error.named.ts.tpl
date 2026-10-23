import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { {{context.pascal}}Codes } from '{{alias.context}}/{{context.kebab}}.codes{{alias.ext}}';

export class UnknownMember extends DomainRefusal {
  readonly code = {{context.pascal}}Codes.UnknownMember;

  static forMembership(organisationId: string, accountId: string) {
    return UnknownMember.refusal(`The account ${accountId} is not a member of ${organisationId}.`, {
      organisationId,
      accountId,
    }).exposing('organisationId', 'accountId');
  }
}
