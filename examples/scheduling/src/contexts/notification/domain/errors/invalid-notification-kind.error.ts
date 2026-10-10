import { DomainError } from '@ddd-ts-kit/kernel';

export class InvalidNotificationKindError extends DomainError {
  readonly code = 'INVALID_NOTIFICATION_KIND';

  constructor(readonly given: string) {
    super(
      `"${given}" is not a kind of notification: a request, a confirmation, a rescheduling, a cancellation or a reminder.`,
    );
  }
}
