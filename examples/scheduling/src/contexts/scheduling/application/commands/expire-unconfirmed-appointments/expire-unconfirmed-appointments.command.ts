import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions.js';

/** Ends every requested appointment whose confirmation deadline is reached at `at`, the instant the occurrence of the job was planned for. */
@Requires(schedulingPermissions['appointment.expire'], {
  resource: () => ({ type: 'context', id: 'scheduling' }),
})
export class ExpireUnconfirmedAppointmentsCommand extends AuthorizedCommand<void> {
  constructor(
    actor: Actor,
    readonly at: Date,
  ) {
    super(actor);
  }
}
