import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { {{context.pascal}}Codes } from '{{alias.context}}/domain/errors/codes{{alias.ext}}';

export class DelegationToOneself extends DomainRefusal {
  readonly code = {{context.pascal}}Codes.DelegationToOneself;

  static forAccount(accountId: string) {
    return DelegationToOneself.refusal('A member delegates to another member.', { accountId });
  }
}
