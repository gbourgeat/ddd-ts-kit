import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { {{context.pascal}}Codes } from '{{alias.context}}/domain/errors/codes{{alias.ext}}';

export class UnknownAccount extends DomainRefusal {
  readonly code = {{context.pascal}}Codes.UnknownAccount;

  static forAccount(accountId: string) {
    return UnknownAccount.refusal(`No account ${accountId}: the person signs in once before acting.`, {
      accountId,
    }).exposing('accountId');
  }
}
