import { describe, expect, it } from 'vitest';
import { Waiter } from '@/contexts/scheduling/waitlist/domain/value-objects/waiter.vo';
import { expectRefusal } from '@ddd-ts-kit/testing';

const joinedAt = new Date('2026-03-01T08:00:00.000Z');
const ada = { patientId: 'patient-1', appointmentTypeId: 'consultation', joinedAt };

describe('Waiter', () => {
  it('is equal to another waiter for the same patient, type and arrival', () => {
    const first = Waiter.create(ada);

    expect(first.equals(Waiter.create({ ...ada, patientId: ' patient-1 ' }))).toBe(true);
    expect(first.equals(Waiter.create({ ...ada, appointmentTypeId: 'surgery' }))).toBe(false);
  });

  it.each([
    ['without a patient', { patientId: '  ' }],
    ['without an appointment type', { appointmentTypeId: '' }],
    ['who joined at no real instant', { joinedAt: new Date('never') }],
  ])('refuses a waiter %s', (_case, facts) => {
    expectRefusal(() => Waiter.create({ ...ada, ...facts }), 'INVALID_WAITER');
  });

  it('keeps who waits, for what and since when', () => {
    expect(Waiter.create(ada)).toMatchObject(ada);
  });
});
