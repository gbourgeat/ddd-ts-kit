import { ProcessRunner } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { ConfirmationDeadlineProcess } from '@/contexts/scheduling/application/calendars/processes/confirmation-deadline.process';
import { AppointmentCancelled } from '@/contexts/scheduling/domain/calendars/events/appointment-cancelled.event';

/** The step of the confirmation deadline of an appointment that is cancelled, in the unit of work that cancelled it. */
@DomainEventHandler(AppointmentCancelled)
export class ConfirmationDeadlineOnCancelledEventHandler implements DomainEventHandler<AppointmentCancelled> {
  private readonly process = new ConfirmationDeadlineProcess();

  constructor(private readonly processes: ProcessRunner) {}

  async handle(event: AppointmentCancelled): Promise<void> {
    await this.processes.run(ConfirmationDeadlineProcess, event.aggregateId, (current) =>
      this.process.settled(current),
    );
  }
}
