import { ProcessRunner } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { ConfirmationDeadlineProcess } from '@/contexts/scheduling/calendars/application/processes/confirmation-deadline.process';
import { AppointmentConfirmed } from '@/contexts/scheduling/calendars/domain/events/appointment-confirmed.event';

/** The step of the confirmation deadline of an appointment that is confirmed, in the unit of work that confirmed it. */
@DomainEventHandler(AppointmentConfirmed)
export class ConfirmationDeadlineOnConfirmedEventHandler implements DomainEventHandler<AppointmentConfirmed> {
  private readonly process = new ConfirmationDeadlineProcess();

  constructor(private readonly processes: ProcessRunner) {}

  async handle(event: AppointmentConfirmed): Promise<void> {
    await this.processes.run(ConfirmationDeadlineProcess, event.aggregateId, (current) =>
      this.process.settled(current),
    );
  }
}
