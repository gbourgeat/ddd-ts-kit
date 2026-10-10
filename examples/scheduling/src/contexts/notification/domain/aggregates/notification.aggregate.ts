import { AggregateRoot } from '@ddd-ts-kit/kernel';
import { NotificationSent } from '../events/notification-sent.event.js';
import type { NotificationKind } from '../value-objects/notification-kind.vo.js';

export interface NotificationState {
  /** The instant the notification was sent. */
  readonly registeredAt: Date;
  readonly recipientId: string;
  readonly kind: NotificationKind;
  readonly appointmentId: string;
  /** The start of the appointment the notification tells about. */
  readonly startsAt: Date;
  /** What made it necessary (the consumed fact, or the reminder and its start): one notification per cause and recipient. */
  readonly cause: string;
}

export class Notification extends AggregateRoot<string> {
  private constructor(
    id: string,
    private state: NotificationState,
  ) {
    super(id);
  }

  /** A notification is born sent: it is the trace of what was handed to the mailer. */
  static create(id: string, facts: Omit<NotificationState, 'registeredAt'>, now: Date): Notification {
    const created = new Notification(id, { ...facts, registeredAt: now });

    created.record(new NotificationSent(id, now, { recipientId: facts.recipientId, kind: facts.kind, appointmentId: facts.appointmentId, startsAt: facts.startsAt }));

    return created;
  }

  static rehydrate(id: string, state: NotificationState): Notification {
    return new Notification(id, state);
  }

  get registeredAt(): Date {
    return this.state.registeredAt;
  }

  get recipientId(): string {
    return this.state.recipientId;
  }

  get kind(): NotificationKind {
    return this.state.kind;
  }

  get appointmentId(): string {
    return this.state.appointmentId;
  }

  get startsAt(): Date {
    return this.state.startsAt;
  }

  toState(): NotificationState {
    return { ...this.state };
  }
}
