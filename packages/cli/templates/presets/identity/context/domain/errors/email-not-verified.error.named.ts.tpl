import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { {{context.pascal}}Codes } from '{{alias.context}}/{{context.kebab}}.codes{{alias.ext}}';

export class EmailNotVerified extends DomainRefusal {
  readonly code = {{context.pascal}}Codes.EmailNotVerified;

  static forAccount(accountId: string) {
    return EmailNotVerified.refusal(
      'The identity provider has not verified the email address of this person: they verify it, then sign in again.',
      { accountId },
    );
  }
}
