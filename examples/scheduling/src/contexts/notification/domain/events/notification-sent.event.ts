import type { DomainEvent } from '@ddd-ts-kit/kernel';
import type { NotificationKind } from '#src/contexts/notification/domain/value-objects/notification-kind.vo.js';

export class NotificationSent implements DomainEvent {
  readonly name = 'notification.notification.sent';

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
