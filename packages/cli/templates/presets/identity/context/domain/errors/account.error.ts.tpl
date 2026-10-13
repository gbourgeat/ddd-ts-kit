import { ConceptError } from '@ddd-ts-kit/kernel';

/** What the accounts refuse: an account is the application's view of one person the identity provider authenticates. */
export class AccountError extends ConceptError {
  static notFound(accountId: string) {
    return AccountError.refusal(
      'ACCOUNT_NOT_FOUND',
      `No account ${accountId}: the person signs in once before acting.`,
      { accountId },
    ).exposing('accountId');
  }

  static deactivated(accountId: string) {
    return AccountError.refusal('ACCOUNT_DEACTIVATED', `The account ${accountId} is deactivated.`, { accountId });
  }

  static alreadyDeactivated(accountId: string) {
    return AccountError.refusal('ACCOUNT_ALREADY_DEACTIVATED', `The account ${accountId} is already deactivated.`, {
      accountId,
    });
  }

  static emailNotVerified(accountId: string) {
    return AccountError.refusal(
      'EMAIL_NOT_VERIFIED',
      'The identity provider has not verified the email address of this person: they verify it, then sign in again.',
      { accountId },
    );
  }

  static invalidEmailAddress(raw: string) {
    return AccountError.refusal('INVALID_EMAIL_ADDRESS', 'An email address is a local part, an @ and a domain.', {
      raw,
    });
  }

  static invalidDisplayName(raw: string) {
    return AccountError.refusal('INVALID_DISPLAY_NAME', 'A display name holds between 1 and 100 characters.', { raw });
  }
}
