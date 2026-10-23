import { systemActor, type ProcessDecision, type ProcessManager } from '@ddd-ts-kit/kernel';
import { ExpireUnconfirmedAppointmentsCommand } from '@/contexts/scheduling/application/calendars/commands/expire-unconfirmed-appointments/expire-unconfirmed-appointments.command';
import type { AppointmentBooked } from '@/contexts/scheduling/domain/calendars/events/appointment-booked.event';

/** The state of the deadline of one requested appointment. */
export interface ConfirmationDeadlineState {
  readonly appointmentId: string;
  /** The deadline, as its ISO text: the state is JSON. */
  readonly confirmBefore: string;
}

/** The one timeout of the process: the deadline of the confirmation. */
const DEADLINE = 'deadline';

/**
 * The confirmation deadline of a requested appointment: armed when it is requested, disarmed
 * when it is confirmed, cancelled or expired, and, when it passes first, the appointment is
 * expired at that very instant instead of at the next run of the expiry job.
 */
export class ConfirmationDeadlineProcess implements ProcessManager<ConfirmationDeadlineState> {
  static readonly processName = 'scheduling.confirmation-deadline';

  static readonly timeoutJob = 'scheduling.confirmation-deadline-timeout';

  static isState(value: unknown): value is ConfirmationDeadlineState {
    return typeof value === 'object' && value !== null && 'appointmentId' in value && 'confirmBefore' in value;
  }

  requested(
    event: AppointmentBooked,
    current: ConfirmationDeadlineState | undefined,
  ): ProcessDecision<ConfirmationDeadlineState> | undefined {
    const { confirmBefore } = event.held;

    if (current !== undefined || confirmBefore === undefined) {
      return undefined;
    }

    return {
      state: { appointmentId: event.aggregateId, confirmBefore: confirmBefore.toISOString() },
      timeouts: [{ name: DEADLINE, at: confirmBefore }],
    };
  }

  /** Confirmed, cancelled or expired: nothing is left to watch. */
  settled(current: ConfirmationDeadlineState | undefined): ProcessDecision<ConfirmationDeadlineState> | undefined {
    return current === undefined ? undefined : { state: current, cancel: [DEADLINE], ended: true };
  }

  timedOut(name: string, current: ConfirmationDeadlineState): ProcessDecision<ConfirmationDeadlineState> | undefined {
    if (name !== DEADLINE) {
      return undefined;
    }

    const actor = systemActor(ConfirmationDeadlineProcess.processName);

    return {
      state: current,
      ended: true,
      commands: [new ExpireUnconfirmedAppointmentsCommand(actor, new Date(current.confirmBefore))],
    };
  }
}
