import { ValueObject, err, ok, type Result } from '@ddd-ts-kit/kernel';
import { InvalidNotificationKindError } from '@/contexts/notification/domain/errors/invalid-notification-kind.error.js';

const KINDS = ['request', 'confirmation', 'rescheduling', 'cancellation', 'reminder'] as const;

type KindName = (typeof KINDS)[number];

export type NotificationKindProps = {
  readonly value: KindName;
};

export class NotificationKind extends ValueObject<NotificationKindProps> {
  private constructor(props: NotificationKindProps) {
    super(props);
  }

  static create(value: string): Result<NotificationKind, InvalidNotificationKindError> {
    const normalized = value.trim().toLowerCase();
    const known = KINDS.find((kind) => kind === normalized);

    if (known === undefined) {
      return err(new InvalidNotificationKindError(value));
    }

    return ok(new NotificationKind({ value: known }));
  }

  /** A request, a confirmation and a rescheduling all tell of an appointment that is still to come, at the start they name. */
  announcesAnAppointmentToCome(): boolean {
    return this.props.value === 'request' || this.props.value === 'confirmation' || this.props.value === 'rescheduling';
  }

  /** A cancellation tells that the appointment will not take place. */
  announcesTheEndOfAnAppointment(): boolean {
    return this.props.value === 'cancellation';
  }

  get value(): string {
    return this.props.value;
  }
}
