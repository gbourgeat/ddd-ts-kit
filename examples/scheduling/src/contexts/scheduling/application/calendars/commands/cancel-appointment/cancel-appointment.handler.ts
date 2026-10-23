import { Access } from '@ddd-ts-kit/auth';
import { type Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { UnknownAppointment } from '@/contexts/scheduling/domain/calendars/errors/unknown-appointment.error';
import type { AppointmentRepository } from '@/contexts/scheduling/domain/calendars/repositories/appointment.repository';
import { Cancellation } from '@/contexts/scheduling/domain/calendars/value-objects/cancellation.vo';
import { schedulingPermissions } from '@/contexts/scheduling/scheduling.permissions';
import { CancelAppointmentCommand } from '@/contexts/scheduling/application/calendars/commands/cancel-appointment/cancel-appointment.command';

@CommandHandler(CancelAppointmentCommand)
export class CancelAppointmentHandler implements CommandHandler<CancelAppointmentCommand> {
  constructor(
    private readonly appointmentRepository: AppointmentRepository,
    private readonly access: Access,
    private readonly clock: Clock,
  ) {}

  /** Whoever cancels an appointment that is not their own acts for the practice that runs its calendar. */
  async execute({ actor, appointmentId, reason }: CancelAppointmentCommand): Promise<string> {
    const appointment = await this.appointmentRepository.findById(appointmentId);

    if (appointment === undefined) {
      throw UnknownAppointment.forAppointment(appointmentId);
    }

    await this.access.authorize(actor, schedulingPermissions['appointment.cancel'], appointment);

    const cancellation = Cancellation.create(actor.id === appointment.patientId ? 'patient' : 'practice', reason);

    appointment.cancel(cancellation, this.clock.now());

    await this.appointmentRepository.save(appointment);

    return appointment.id;
  }
}
