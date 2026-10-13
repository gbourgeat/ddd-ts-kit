import type { DomainEvent } from '@ddd-ts-kit/kernel';

export class ReminderSent implements DomainEvent {
  static readonly eventName = 'notification.reminder.sent';

  readonly name = ReminderSent.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly about: { readonly recipientId: string; readonly appointmentId: string; readonly startsAt: Date },
  ) {}
}
