import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { {{context.pascal}}Codes } from '{{alias.context}}/domain/errors/codes{{alias.ext}}';

export class AlreadyMember extends DomainRefusal {
  readonly code = {{context.pascal}}Codes.AlreadyMember;

  static forMembership(organisationId: string, accountId: string) {
    return AlreadyMember.refusal(`The account ${accountId} is already a member of ${organisationId}.`, {
      organisationId,
      accountId,
    }).exposing('organisationId', 'accountId');
  }
}
