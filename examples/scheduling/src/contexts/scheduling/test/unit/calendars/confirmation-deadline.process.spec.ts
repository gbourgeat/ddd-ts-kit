import { describe, expect, it } from 'vitest';
import { givenProcess } from '@ddd-ts-kit/testing';
import { ExpireUnconfirmedAppointmentsCommand } from '@/contexts/scheduling/calendars/application/commands/expire-unconfirmed-appointments/expire-unconfirmed-appointments.command';
import {
  ConfirmationDeadlineProcess,
  type ConfirmationDeadlineState,
} from '@/contexts/scheduling/calendars/application/processes/confirmation-deadline.process';
import { AppointmentBooked } from '@/contexts/scheduling/calendars/domain/events/appointment-booked.event';
import { anAppointment } from '@/contexts/scheduling/test/builders/appointment.builder';

const deadline = new Date('2026-03-01T12:00:00.000Z');
const process = new ConfirmationDeadlineProcess();
const booking = anAppointment().build().booking;
const watching: ConfirmationDeadlineState = { appointmentId: 'appointment-1', confirmBefore: deadline.toISOString() };

describe('The confirmation deadline of an appointment', () => {
  it('is armed when the appointment is requested, for its deadline', () => {
    givenProcess<ConfirmationDeadlineState>(undefined)
      .when((current) =>
        process.requested(
          new AppointmentBooked('appointment-1', deadline, { booking, confirmBefore: deadline }),
          current,
        ),
      )
      .thenState(watching)
      .thenTimeouts([{ name: 'deadline', at: deadline }])
      .thenCommands([]);
  });

  it('is not armed for an appointment booked outright, nor twice', () => {
    givenProcess<ConfirmationDeadlineState>(undefined)
      .when((current) => process.requested(new AppointmentBooked('appointment-1', deadline, { booking }), current))
      .thenIgnored();

    givenProcess(watching)
      .when((current) =>
        process.requested(
          new AppointmentBooked('appointment-1', deadline, { booking, confirmBefore: deadline }),
          current,
        ),
      )
      .thenIgnored();
  });

  it('is disarmed once the appointment is confirmed, cancelled or expired', () => {
    givenProcess(watching)
      .when((current) => process.settled(current))
      .thenCancelled(['deadline'])
      .thenEnded();

    givenProcess<ConfirmationDeadlineState>(undefined)
      .when((current) => process.settled(current))
      .thenIgnored();
  });

  it('expires the appointment at its deadline, as the process itself', () => {
    givenProcess(watching)
      .when(timedOut('deadline'))
      .thenCommands([ExpireUnconfirmedAppointmentsCommand])
      .thenCommands([{ at: deadline, actor: { id: 'system:scheduling.confirmation-deadline' } }])
      .thenEnded();

    givenProcess(watching).when(timedOut('reminder')).thenIgnored();
  });

  it('recognises the state it saved', () => {
    expect(ConfirmationDeadlineProcess.isState(watching)).toBe(true);
    expect(ConfirmationDeadlineProcess.isState({ appointmentId: 'appointment-1' })).toBe(false);
    expect(ConfirmationDeadlineProcess.isState(null)).toBe(false);
  });
});

/** The process told that one of its timeouts fired, while it watches an appointment. */
function timedOut(timeout: Parameters<typeof process.timedOut>[0]) {
  return (current: ConfirmationDeadlineState | undefined) =>
    current === undefined ? undefined : process.timedOut(timeout, current);
}
