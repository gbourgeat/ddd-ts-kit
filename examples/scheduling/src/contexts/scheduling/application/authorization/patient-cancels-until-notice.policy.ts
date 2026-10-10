import type { PolicyContext } from '@ddd-ts-kit/auth';
import { isAuthenticated, type Actor } from '@ddd-ts-kit/kernel';
import { Policy } from '@ddd-ts-kit/kernel/declarations';
import { Appointment } from '@/contexts/scheduling/domain/aggregates/appointment.aggregate.js';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions.js';

/** The notice a patient owes the practice, in hours before the start. */
const NOTICE = 24;
const HOUR = 60 * 60_000;

/** A patient cancels their own appointment freely until 24 hours before its start; later, the practice decides. Whoever else holds the right acts for the practice, at any time. */
@Policy(schedulingPermissions['appointment.cancel'], { name: 'scheduling.patient-cancels-until-notice' })
export class PatientCancelsUntilNoticePolicy {
  appliesTo(subject: unknown): subject is Appointment {
    return subject instanceof Appointment;
  }

  allows(actor: Actor, appointment: Appointment, { now }: PolicyContext): boolean {
    if (!isAuthenticated(actor)) {
      return false;
    }

    return actor.id !== appointment.patientId || appointment.slot.startsAt.getTime() - now.getTime() >= NOTICE * HOUR;
  }
}
