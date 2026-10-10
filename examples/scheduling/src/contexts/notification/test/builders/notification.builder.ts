import { unwrap } from '@ddd-ts-kit/kernel';
import { Builder, sequence, type Defaults } from '@ddd-ts-kit/testing';
import { Notification } from '@/contexts/notification/domain/aggregates/notification.aggregate.js';
import { NotificationKind } from '@/contexts/notification/domain/value-objects/notification-kind.vo.js';

interface NotificationIngredients {
  readonly id: string;
  readonly bornAt: Date;
  readonly recipientId: string;
  readonly kind: string;
  readonly appointmentId: string;
  readonly startsAt: Date;
  readonly cause: string;
}

export class NotificationBuilder extends Builder<NotificationIngredients, Notification> {
  identifiedBy(id: string): this {
    return this.with('id', id);
  }

  bornAt(instant: Date): this {
    return this.with('bornAt', instant);
  }

  sentTo(recipientId: string): this {
    return this.with('recipientId', recipientId);
  }

  ofKind(kind: string): this {
    return this.with('kind', kind);
  }

  about(appointmentId: string, startsAt: Date): this {
    return this.with('appointmentId', appointmentId).with('startsAt', startsAt);
  }

  causedBy(cause: string): this {
    return this.with('cause', cause);
  }

  protected defaults(): Defaults<NotificationIngredients> {
    return {
      id: sequence('notification'),
      bornAt: new Date('2026-01-01T00:00:00.000Z'),
      recipientId: 'patient-1',
      kind: 'confirmation',
      appointmentId: 'appointment-1',
      startsAt: new Date('2026-01-10T09:00:00.000Z'),
      cause: sequence('fact'),
    };
  }

  protected construct(ingredients: NotificationIngredients): Notification {
    const { id, bornAt, kind, ...facts } = ingredients;

    return Notification.create(id, { ...facts, kind: unwrap(NotificationKind.create(kind)) }, bornAt);
  }
}

export function aNotification(): NotificationBuilder {
  return new NotificationBuilder();
}
