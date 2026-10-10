import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions.js';

/** Sent by the context itself when an appointment frees what it held. Answers the identifier of the appointment requested for a waiter, or nothing when nobody took the slot. */
@Requires(schedulingPermissions['waitlist.offer'], { resource: () => ({ type: 'context', id: 'scheduling' }) })
export class OfferFreedSlotCommand extends AuthorizedCommand<string | undefined> {
  constructor(
    actor: Actor,
    readonly calendarId: string,
    /** The start and the end of the appointment that held the slot, and the end of what it held with its buffer. */
    readonly freed: { readonly startsAt: Date; readonly endsAt: Date; readonly heldUntil: Date },
  ) {
    super(actor);
  }
}
