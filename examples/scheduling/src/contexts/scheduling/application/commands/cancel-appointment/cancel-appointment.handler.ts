import { Access } from '@ddd-ts-kit/auth';
import { Clock, unwrap } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { AppointmentNotFoundError } from '@/contexts/scheduling/domain/errors/appointment-not-found.error.js';
import { AppointmentRepository } from '@/contexts/scheduling/domain/repositories/appointment.repository.js';
import { Cancellation } from '@/contexts/scheduling/domain/value-objects/cancellation.vo.js';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions.js';
import { CancelAppointmentCommand } from '@/contexts/scheduling/application/commands/cancel-appointment/cancel-appointment.command.js';

@CommandHandler(CancelAppointmentCommand, [AppointmentRepository, Access, Clock])
export class CancelAppointmentHandler implements CommandHandler<CancelAppointmentCommand> {
  constructor(
    private readonly appointmentRepository: AppointmentRepository,
    private readonly access: Access,
    private readonly clock: Clock,
  ) {}

  /** Whoever cancels an appointment that is not their own acts for the practice that runs its calendar. */
  async execute({ actor, appointmentId, reason }: CancelAppointmentCommand): Promise<string> {
    const target = await this.appointmentRepository.findById(appointmentId);

    if (target === undefined) {
      throw new AppointmentNotFoundError(appointmentId);
    }

    await this.access.authorize(actor, schedulingPermissions['appointment.cancel'], target);

    const cancellation = unwrap(Cancellation.create(actor.id === target.patientId ? 'patient' : 'practice', reason));

    target.cancel(cancellation, this.clock.now());

    await this.appointmentRepository.save(target);

    return target.id;
  }
}
