import type { DomainEvent } from '@ddd-ts-kit/kernel';

export class ReminderSent implements DomainEvent {
  readonly name = 'notification.reminder.sent';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly about: { readonly recipientId: string; readonly appointmentId: string; readonly startsAt: Date },
  ) {}
}
