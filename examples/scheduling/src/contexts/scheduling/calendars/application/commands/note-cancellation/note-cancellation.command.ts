import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { schedulingPermissions } from '@/contexts/scheduling/scheduling.permissions';

/** Sent by the context itself when a patient cancels an appointment: noted, with their words, in their attendance record. Answers the identifier of the record. */
@Requires(schedulingPermissions['attendance.note'], { resource: () => ({ type: 'context', id: 'scheduling' }) })
export class NoteCancellationCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly practiceId: string,
    readonly patientId: string,
    readonly appointment: { readonly id: string; readonly startsAt: Date },
    readonly reason: string | undefined,
  ) {
    super(actor);
  }
}
