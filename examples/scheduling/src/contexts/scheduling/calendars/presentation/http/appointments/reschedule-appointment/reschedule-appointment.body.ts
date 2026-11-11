import { pickClass } from '@ddd-ts-kit/validation/class-validator';
import { TimeSpan } from '@/contexts/scheduling/shared/presentation/http/shared/time-span.schema';

/** The instant the appointment starts from now on: its end follows from its type. */
export class RescheduleAppointmentBody extends pickClass(TimeSpan, ['startsAt']) {}
