import { DomainError } from '@ddd-ts-kit/kernel';

export class ContactUnknownError extends DomainError {
  readonly code = 'CONTACT_UNKNOWN';

  constructor(readonly recipientId: string) {
    super(`No contact is known for the recipient ${recipientId}: nothing can be sent to them yet.`);
  }
}
