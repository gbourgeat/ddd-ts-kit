import { ValueObject } from '@ddd-ts-kit/kernel';
import { NotificationError } from '@/contexts/notification/domain/errors/notification.error';

const KINDS = ['request', 'confirmation', 'rescheduling', 'cancellation', 'reminder'] as const;

type KindName = (typeof KINDS)[number];

export type NotificationKindProps = {
  readonly value: KindName;
};

export class NotificationKind extends ValueObject<NotificationKindProps> {
  private constructor(props: NotificationKindProps) {
    super(props);
  }

  static create(value: string): NotificationKind {
    const normalized = value.trim().toLowerCase();
    const known = KINDS.find((kind) => kind === normalized);

    if (known === undefined) {
      throw NotificationError.invalidNotificationKind(value);
    }

    return new NotificationKind({ value: known });
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
