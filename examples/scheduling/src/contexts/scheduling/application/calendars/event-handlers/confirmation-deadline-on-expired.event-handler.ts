import { ProcessRunner } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { ConfirmationDeadlineProcess } from '@/contexts/scheduling/application/calendars/processes/confirmation-deadline.process';
import { AppointmentExpired } from '@/contexts/scheduling/domain/calendars/events/appointment-expired.event';

/** The step of the confirmation deadline of an appointment that is expired, in the unit of work that expired it. */
@DomainEventHandler(AppointmentExpired)
export class ConfirmationDeadlineOnExpiredEventHandler implements DomainEventHandler<AppointmentExpired> {
  private readonly process = new ConfirmationDeadlineProcess();

  constructor(private readonly processes: ProcessRunner) {}

  async handle(event: AppointmentExpired): Promise<void> {
    await this.processes.run(ConfirmationDeadlineProcess, event.aggregateId, (current) =>
      this.process.settled(current),
    );
  }
}
