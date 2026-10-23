import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { SchedulingCodes } from '@/contexts/scheduling/scheduling.codes';

export class BookingTooFar extends DomainRefusal {
  readonly code = SchedulingCodes.BookingTooFar;

  static withHorizon(horizon: number) {
    return BookingTooFar.refusal(`A slot is booked at most ${horizon} minutes before it starts.`, { horizon }).exposing(
      'horizon',
    );
  }
}
