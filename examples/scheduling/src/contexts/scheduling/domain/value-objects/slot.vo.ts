import { ValueObject, err, ok, unwrap, type Result } from '@ddd-ts-kit/kernel';
import { AppointmentError } from '@/contexts/scheduling/domain/errors/appointment.error';

export type SlotProps = {
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly heldUntil: Date;
};

export class Slot extends ValueObject<SlotProps> {
  private constructor(props: SlotProps) {
    super(props);
  }

  /** The start, the end of the appointment, and the end of what it holds once the buffer is counted. */
  static create(startsAt: Date, endsAt: Date, heldUntil: Date): Result<Slot, AppointmentError> {
    if ([startsAt, endsAt, heldUntil].some((instant) => Number.isNaN(instant.getTime()))) {
      return err(AppointmentError.invalidSlot('is made of real instants'));
    }

    if (endsAt.getTime() <= startsAt.getTime()) {
      return err(AppointmentError.invalidSlot('ends after it starts'));
    }

    if (heldUntil.getTime() < endsAt.getTime()) {
      return err(AppointmentError.invalidSlot('is held at least until it ends'));
    }

    return ok(new Slot({ startsAt: new Date(startsAt), endsAt: new Date(endsAt), heldUntil: new Date(heldUntil) }));
  }

  /** The same as `create`, for a caller that holds valid instants: throws the error instead of answering it. */
  static between(startsAt: Date, endsAt: Date, heldUntil: Date): Slot {
    return unwrap(Slot.create(startsAt, endsAt, heldUntil));
  }

  /** Two slots overlap when what they hold, buffer included, has an instant in common. */
  overlaps(other: Slot): boolean {
    return this.startsAt.getTime() < other.heldUntil.getTime() && other.startsAt.getTime() < this.heldUntil.getTime();
  }

  startsAfter(instant: Date): boolean {
    return this.startsAt.getTime() > instant.getTime();
  }

  get startsAt(): Date {
    return new Date(this.props.startsAt);
  }

  get endsAt(): Date {
    return new Date(this.props.endsAt);
  }

  get heldUntil(): Date {
    return new Date(this.props.heldUntil);
  }
}
