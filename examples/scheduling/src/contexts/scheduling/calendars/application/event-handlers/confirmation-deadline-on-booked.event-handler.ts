import { ProcessRunner } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { ConfirmationDeadlineProcess } from '@/contexts/scheduling/calendars/application/processes/confirmation-deadline.process';
import { AppointmentBooked } from '@/contexts/scheduling/calendars/domain/events/appointment-booked.event';

/** The step of the confirmation deadline of an appointment that is booked, in the unit of work that booked it. */
@DomainEventHandler(AppointmentBooked)
export class ConfirmationDeadlineOnBookedEventHandler implements DomainEventHandler<AppointmentBooked> {
  private readonly process = new ConfirmationDeadlineProcess();

  constructor(private readonly processes: ProcessRunner) {}

  async handle(event: AppointmentBooked): Promise<void> {
    await this.processes.run(ConfirmationDeadlineProcess, event.aggregateId, (current) =>
      this.process.requested(event, current),
    );
  }
}
