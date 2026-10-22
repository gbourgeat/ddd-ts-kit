import type { DomainEvent } from '@ddd-ts-kit/kernel';

export class CalendarAppointmentTypeDefined implements DomainEvent {
  static readonly eventName = 'scheduling.calendar.appointment-type-defined';

  readonly name = CalendarAppointmentTypeDefined.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly appointmentTypeId: string,
  ) {}
}
