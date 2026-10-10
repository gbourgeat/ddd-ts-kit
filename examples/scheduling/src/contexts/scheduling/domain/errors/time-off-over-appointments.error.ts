import { DomainError } from '@ddd-ts-kit/kernel';

export class TimeOffOverAppointmentsError extends DomainError {
  readonly code = 'TIME_OFF_OVER_APPOINTMENTS';

  constructor(held: number) {
    super(`The time off covers ${held} active appointment(s).`);
  }
}
