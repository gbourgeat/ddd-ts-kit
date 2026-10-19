import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { {{context.pascal}}Codes } from '{{alias.context}}/domain/errors/codes{{alias.ext}}';

export class DeactivatedAccount extends DomainRefusal {
  readonly code = {{context.pascal}}Codes.DeactivatedAccount;

  static forAccount(accountId: string) {
    return DeactivatedAccount.refusal(`The account ${accountId} is deactivated.`, { accountId });
  }
}
