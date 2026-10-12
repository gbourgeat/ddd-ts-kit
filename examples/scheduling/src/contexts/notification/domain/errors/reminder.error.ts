import { ConceptError } from '@ddd-ts-kit/kernel';

export class ReminderError extends ConceptError {
  static notDue(reminderId: string) {
    return ReminderError.refusal(
      'REMINDER_NOT_DUE',
      `The reminder ${reminderId} is not due: it is sent once, from 24 hours before the start until the start, and only while it is planned.`,
      { reminderId },
    );
  }
}
