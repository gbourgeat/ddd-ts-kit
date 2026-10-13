import type { DomainEvent } from '@ddd-ts-kit/kernel';
import type { NotificationKind } from '@/contexts/notification/domain/value-objects/notification-kind.vo';

export class NotificationSent implements DomainEvent {
  static readonly eventName = 'notification.notification.sent';

  readonly name = NotificationSent.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly about: {
      readonly recipientId: string;
      readonly kind: NotificationKind;
      readonly appointmentId: string;
      readonly startsAt: Date;
    },
  ) {}
}
