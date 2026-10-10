import { describe, expect, it } from 'vitest';
import { unwrap } from '@ddd-ts-kit/kernel';
import { InvalidWaiterError } from '@/contexts/scheduling/domain/errors/invalid-waiter.error.js';
import { Waiter } from '@/contexts/scheduling/domain/value-objects/waiter.vo.js';

const joinedAt = new Date('2026-03-01T08:00:00.000Z');
const ada = { patientId: 'patient-1', appointmentTypeId: 'consultation', joinedAt };

describe('Waiter', () => {
  it('is equal to another waiter for the same patient, type and arrival', () => {
    const first = unwrap(Waiter.create(ada));

    expect(first.equals(unwrap(Waiter.create({ ...ada, patientId: ' patient-1 ' })))).toBe(true);
    expect(first.equals(unwrap(Waiter.create({ ...ada, appointmentTypeId: 'surgery' })))).toBe(false);
  });

  it.each([
    ['without a patient', { patientId: '  ' }],
    ['without an appointment type', { appointmentTypeId: '' }],
    ['who joined at no real instant', { joinedAt: new Date('never') }],
  ])('refuses a waiter %s', (_case, facts) => {
    expect(Waiter.create({ ...ada, ...facts })).toMatchObject({ ok: false, error: expect.any(InvalidWaiterError) });
  });

  it('keeps who waits, for what and since when', () => {
    expect(unwrap(Waiter.create(ada))).toMatchObject(ada);
  });
});
