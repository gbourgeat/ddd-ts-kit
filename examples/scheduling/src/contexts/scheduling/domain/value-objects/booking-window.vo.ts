import { ValueObject } from '@ddd-ts-kit/kernel';
import { InvalidBookingWindow } from '@/contexts/scheduling/domain/errors/invalid-booking-window.error';

export type BookingWindowProps = {
  /** The minimum minutes between booking and start. */
  readonly notice: number;
  /** The maximum minutes between booking and start. */
  readonly horizon: number;
};

const MINUTE = 60_000;
const STANDARD_NOTICE = 2 * 60;
const STANDARD_HORIZON = 90 * 24 * 60;

/** The earliest and the latest a slot can be booked. */
export class BookingWindow extends ValueObject<BookingWindowProps> {
  private constructor(props: BookingWindowProps) {
    super(props);
  }

  static create(notice: number, horizon: number): BookingWindow {
    if (!Number.isInteger(notice) || notice < 0) {
      throw InvalidBookingWindow.forRule('has a notice of whole minutes');
    }

    if (!Number.isInteger(horizon) || horizon <= notice) {
      throw InvalidBookingWindow.forRule('has a horizon after its notice');
    }

    return new BookingWindow({ notice, horizon });
  }

  /** What a calendar is born with: a notice of two hours, a horizon of ninety days. */
  static standard(): BookingWindow {
    return new BookingWindow({ notice: STANDARD_NOTICE, horizon: STANDARD_HORIZON });
  }

  /** Whether a start is closer to the booking than the notice allows. */
  isTooLate(startsAt: Date, now: Date): boolean {
    return startsAt.getTime() - now.getTime() < this.props.notice * MINUTE;
  }

  /** Whether a start is further from the booking than the horizon allows. */
  isTooFar(startsAt: Date, now: Date): boolean {
    return startsAt.getTime() - now.getTime() > this.props.horizon * MINUTE;
  }

  get notice(): number {
    return this.props.notice;
  }

  get horizon(): number {
    return this.props.horizon;
  }
}
