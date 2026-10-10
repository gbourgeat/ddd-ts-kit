import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';

export class CancelAppointmentCommand extends AuthorizedCommand {
  constructor(
    actor: Actor,
    readonly appointmentId: string,
  ) {
    super(actor);
  }
}
