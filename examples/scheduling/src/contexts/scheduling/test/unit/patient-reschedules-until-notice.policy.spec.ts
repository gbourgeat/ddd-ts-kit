import { describe, expect, it } from 'vitest';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { anonymousActor } from '@ddd-ts-kit/kernel';
import { declarationOf } from '@ddd-ts-kit/kernel/declarations';
import { PatientReschedulesUntilNoticePolicy } from '../../application/authorization/patient-reschedules-until-notice.policy.js';
import { anAppointment } from '../builders/appointment.builder.js';
import { aCalendar } from '../builders/calendar.builder.js';

const policy = new PatientReschedulesUntilNoticePolicy();
const patient = anActor().named('patient-1').build();
const appointment = anAppointment().forPatient('patient-1').startingAt(new Date('2026-03-02T09:00:00.000Z')).build();
const dayBefore = new Date('2026-03-01T09:00:00.000Z');

describe('Patient reschedules until notice', () => {
  it('bears on the permission appointment.reschedule, under a name of its own', () => {
    expect(declarationOf(PatientReschedulesUntilNoticePolicy)).toMatchObject({ role: 'policy', name: 'scheduling.patient-reschedules-until-notice', permission: { id: 'scheduling:appointment.reschedule' } });
  });

  it('refuses a caller nobody identified', () => {
    expect(policy.allows(anonymousActor(), appointment, { now: dayBefore })).toBe(false);
  });

  it('allows the patient of the appointment exactly 24 hours before its start', () => {
    expect(policy.allows(patient, appointment, { now: dayBefore })).toBe(true);
  });

  it('allows the patient of the appointment long before its start', () => {
    expect(policy.allows(patient, appointment, { now: new Date('2026-02-01T09:00:00.000Z') })).toBe(true);
  });

  it('refuses the patient of the appointment one millisecond inside the last 24 hours', () => {
    expect(policy.allows(patient, appointment, { now: new Date(dayBefore.getTime() + 1) })).toBe(false);
  });

  it('refuses the patient of the appointment after its start', () => {
    expect(policy.allows(patient, appointment, { now: new Date('2026-03-02T10:00:00.000Z') })).toBe(false);
  });

  it('leaves whoever acts for the practice free at any time, whatever their role', () => {
    const someoneElse = anActor().named('assistant-1').withRole('patient').build();

    expect(policy.allows(someoneElse, appointment, { now: new Date('2026-03-02T08:59:00.000Z') })).toBe(true);
  });

  it('applies to appointments and to nothing else', () => {
    expect(policy.appliesTo(appointment)).toBe(true);
    expect(policy.appliesTo(aCalendar().build())).toBe(false);
    expect(policy.appliesTo({ type: 'appointment', id: appointment.id })).toBe(false);
  });
});
