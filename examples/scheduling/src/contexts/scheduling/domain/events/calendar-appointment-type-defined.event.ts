import type { DomainEvent } from '@ddd-ts-kit/kernel';

export class CalendarAppointmentTypeDefined implements DomainEvent {
  readonly name = 'scheduling.calendar.appointment-type-defined';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly appointmentTypeId: string,
  ) {}
}
