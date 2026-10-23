import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { {{context.pascal}}Codes } from '{{alias.context}}/{{context.kebab}}.codes{{alias.ext}}';

export class AccountAlreadyDeactivated extends DomainRefusal {
  readonly code = {{context.pascal}}Codes.AccountAlreadyDeactivated;

  static forAccount(accountId: string) {
    return AccountAlreadyDeactivated.refusal(`The account ${accountId} is already deactivated.`, { accountId });
  }
}
