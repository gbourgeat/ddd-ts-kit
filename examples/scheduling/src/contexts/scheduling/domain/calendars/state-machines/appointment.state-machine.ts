import { defineStateMachine, type DomainError } from '@ddd-ts-kit/kernel';
import { AppointmentAlreadyConfirmed } from '@/contexts/scheduling/domain/calendars/errors/appointment-already-confirmed.error';
import { AppointmentEnded } from '@/contexts/scheduling/domain/calendars/errors/appointment-ended.error';
import { AppointmentNotStarted } from '@/contexts/scheduling/domain/calendars/errors/appointment-not-started.error';
import { AppointmentStatus } from '@/contexts/scheduling/domain/calendars/vocabularies/appointment-status.vocabulary';

/** What the transitions of an appointment are judged with. */
interface AppointmentMoment {
  readonly appointmentId: string;
  /** The instant the transition is asked. */
  readonly at: Date;
  /** The instant the slot of the appointment starts. */
  readonly startsAt: Date;
}

/** The lifecycle of an appointment: requested or booked, then one of four ends. */
export const appointmentLifecycle = defineStateMachine({
  states: Object.values(AppointmentStatus),
  initial: [AppointmentStatus.Requested, AppointmentStatus.Booked],
  transitions: {
    confirm: { from: [AppointmentStatus.Requested], to: AppointmentStatus.Booked },
    reschedule: { from: [AppointmentStatus.Requested, AppointmentStatus.Booked] },
    annotate: { from: [AppointmentStatus.Requested, AppointmentStatus.Booked] },
    cancel: { from: [AppointmentStatus.Requested, AppointmentStatus.Booked], to: AppointmentStatus.Cancelled },
    expire: { from: [AppointmentStatus.Requested], to: AppointmentStatus.Expired },
    complete: {
      from: [AppointmentStatus.Requested, AppointmentStatus.Booked],
      to: AppointmentStatus.Completed,
      guard: started,
    },
    markNoShow: {
      from: [AppointmentStatus.Requested, AppointmentStatus.Booked],
      to: AppointmentStatus.NoShow,
      guard: started,
    },
  },
  refused,
});

/** An outcome is known once the appointment started. */
function started({ appointmentId, at, startsAt }: AppointmentMoment): DomainError | undefined {
  return startsAt.getTime() > at.getTime() ? AppointmentNotStarted.forAppointment(appointmentId, startsAt) : undefined;
}

/** A booked appointment has nothing left to confirm; any other refusal comes from an appointment that ended. */
function refused(
  { from, transition }: { readonly from: AppointmentStatus; readonly transition: string },
  { appointmentId }: AppointmentMoment,
): DomainError {
  return from === AppointmentStatus.Booked && transition === 'confirm'
    ? AppointmentAlreadyConfirmed.forAppointment(appointmentId)
    : AppointmentEnded.forAppointment(appointmentId, from);
}
