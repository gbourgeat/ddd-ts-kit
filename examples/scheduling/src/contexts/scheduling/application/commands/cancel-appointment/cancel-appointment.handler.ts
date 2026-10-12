import { Access } from '@ddd-ts-kit/auth';
import { type Clock, unwrap } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { AppointmentError } from '@/contexts/scheduling/domain/errors/appointment.error';
import type { AppointmentRepository } from '@/contexts/scheduling/domain/repositories/appointment.repository';
import { Cancellation } from '@/contexts/scheduling/domain/value-objects/cancellation.vo';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions';
import { CancelAppointmentCommand } from '@/contexts/scheduling/application/commands/cancel-appointment/cancel-appointment.command';

@CommandHandler(CancelAppointmentCommand)
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
      throw AppointmentError.notFound(appointmentId);
    }

    await this.access.authorize(actor, schedulingPermissions['appointment.cancel'], target);

    const cancellation = unwrap(Cancellation.create(actor.id === target.patientId ? 'patient' : 'practice', reason));

    target.cancel(cancellation, this.clock.now());

    await this.appointmentRepository.save(target);

    return target.id;
  }
}
