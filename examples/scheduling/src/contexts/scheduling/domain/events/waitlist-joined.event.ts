import type { DomainEvent } from '@ddd-ts-kit/kernel';

export class WaitlistJoined implements DomainEvent {
  readonly name = 'scheduling.waitlist.joined';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly patientId: string,
    readonly appointmentTypeId: string,
  ) {}
}
