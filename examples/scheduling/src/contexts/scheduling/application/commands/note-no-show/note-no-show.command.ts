import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions';

/** Sent by the context itself when an appointment is marked as a no-show: noted in the attendance record of its patient. Answers the identifier of the record. */
@Requires(schedulingPermissions['attendance.note'], { resource: () => ({ type: 'context', id: 'scheduling' }) })
export class NoteNoShowCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly practiceId: string,
    readonly patientId: string,
    readonly appointmentId: string,
    readonly startsAt: Date,
  ) {
    super(actor);
  }
}
