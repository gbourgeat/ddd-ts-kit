import type { DomainEvent } from '@ddd-ts-kit/kernel';

export class WaitlistJoined implements DomainEvent {
  static readonly eventName = 'scheduling.waitlist.joined';

  readonly name = WaitlistJoined.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly patientId: string,
    readonly appointmentTypeId: string,
  ) {}
}
