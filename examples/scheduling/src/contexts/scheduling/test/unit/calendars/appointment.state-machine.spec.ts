import { describe, expect, it } from 'vitest';
import { mermaidOfStateMachine } from '@ddd-ts-kit/kernel';
import { appointmentLifecycle } from '@/contexts/scheduling/calendars/domain/state-machines/appointment.state-machine';
import { AppointmentStatus } from '@/contexts/scheduling/calendars/domain/vocabularies/appointment-status.vocabulary';

const startsAt = new Date('2026-03-02T09:00:00.000Z');
const before = { appointmentId: 'appointment-1', at: new Date('2026-03-02T08:00:00.000Z'), startsAt };
const after = { ...before, at: new Date('2026-03-02T09:30:00.000Z') };

describe('the lifecycle of an appointment', () => {
  it('starts requested or booked, never in one of its ends', () => {
    expect(appointmentLifecycle.start(AppointmentStatus.Requested)).toBe('requested');
    expect(() => appointmentLifecycle.start(AppointmentStatus.Cancelled)).toThrow(/not an initial state/);
  });

  it('confirms a requested appointment, and refuses to confirm a booked one', () => {
    expect(appointmentLifecycle.next(AppointmentStatus.Requested, 'confirm', before)).toBe('booked');

    expect(() => appointmentLifecycle.next(AppointmentStatus.Booked, 'confirm', before)).toThrow(
      expect.objectContaining({ code: 'APPOINTMENT_ALREADY_CONFIRMED' }),
    );
  });

  it('refuses every change of an appointment that ended, saying which end', () => {
    for (const end of [AppointmentStatus.Cancelled, AppointmentStatus.Expired, AppointmentStatus.Completed]) {
      expect(() => appointmentLifecycle.next(end, 'reschedule', after)).toThrow(
        expect.objectContaining({ code: 'APPOINTMENT_ENDED', facts: { appointmentId: 'appointment-1', status: end } }),
      );
    }
  });

  it('knows the outcome of an appointment once it started, not before', () => {
    expect(appointmentLifecycle.next(AppointmentStatus.Booked, 'complete', after)).toBe('completed');
    expect(appointmentLifecycle.can(AppointmentStatus.Booked, 'markNoShow', before)).toBe(false);

    expect(() => appointmentLifecycle.next(AppointmentStatus.Booked, 'markNoShow', before)).toThrow(
      expect.objectContaining({ code: 'APPOINTMENT_NOT_STARTED' }),
    );
  });

  it('expires only a requested appointment, and keeps its status when it moves', () => {
    expect(appointmentLifecycle.can(AppointmentStatus.Booked, 'expire', after)).toBe(false);
    expect(appointmentLifecycle.next(AppointmentStatus.Requested, 'reschedule', before)).toBe('requested');
  });

  it('has four ends, which CONTEXT.md draws', () => {
    const lifecycle = appointmentLifecycle.describe();

    expect(lifecycle.final).toEqual(['cancelled', 'expired', 'completed', 'no-show']);
    expect(mermaidOfStateMachine(lifecycle)).toContain('booked --> no_show: markNoShow [guarded]');
  });
});
