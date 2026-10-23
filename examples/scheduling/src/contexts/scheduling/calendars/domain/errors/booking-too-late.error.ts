import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { SchedulingCodes } from '@/contexts/scheduling/scheduling.codes';

export class BookingTooLate extends DomainRefusal {
  readonly code = SchedulingCodes.BookingTooLate;

  static withNotice(notice: number) {
    return BookingTooLate.refusal(`A slot is booked at least ${notice} minutes before it starts.`, { notice }).exposing(
      'notice',
    );
  }
}
