import { ValueObject } from '@ddd-ts-kit/kernel';
import { InvalidNotificationKind } from '@/contexts/notification/domain/errors/invalid-notification-kind.error';
import { NotificationKindName } from '@/contexts/notification/domain/vocabularies/notification-kind-name.vocabulary';

const KINDS = [
  NotificationKindName.Request,
  NotificationKindName.Confirmation,
  NotificationKindName.Rescheduling,
  NotificationKindName.Cancellation,
  NotificationKindName.Reminder,
] as const;

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
      throw InvalidNotificationKind.forKind(value);
    }

    return new NotificationKind({ value: known });
  }

  /** A request, a confirmation and a rescheduling all tell of an appointment that is still to come, at the start they name. */
  announcesAnAppointmentToCome(): boolean {
    return (
      this.props.value === NotificationKindName.Request ||
      this.props.value === NotificationKindName.Confirmation ||
      this.props.value === NotificationKindName.Rescheduling
    );
  }

  /** A cancellation tells that the appointment will not take place. */
  announcesTheEndOfAnAppointment(): boolean {
    return this.props.value === NotificationKindName.Cancellation;
  }

  get value(): string {
    return this.props.value;
  }
}
