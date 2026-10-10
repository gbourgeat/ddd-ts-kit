import { DomainError } from '@ddd-ts-kit/kernel';

export class ReminderNotDueError extends DomainError {
  readonly code = 'REMINDER_NOT_DUE';

  constructor(readonly reminderId: string) {
    super(`The reminder ${reminderId} is not due: it is sent once, from 24 hours before the start until the start, and only while it is planned.`);
  }
}
