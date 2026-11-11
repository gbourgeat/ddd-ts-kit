import { describe, expect, it } from 'vitest';
import { AttendanceRecordCancellationNoted } from '@/contexts/scheduling/calendars/domain/events/attendance-record-cancellation-noted.event';

describe('AttendanceRecordCancellationNoted', () => {
  it('is named after the context, the aggregate and the fact', () => {
    const event = new AttendanceRecordCancellationNoted('practice-1.patient-1', new Date('2026-01-01T00:00:00.000Z'), {
      patientId: 'patient-1',
      appointmentId: 'appointment-1',
      startsAt: new Date('2026-01-02T09:00:00.000Z'),
      reason: undefined,
    });

    expect(event.name).toBe('scheduling.attendance-record.cancellation-noted');
    expect(event.aggregateId).toBe('practice-1.patient-1');
  });
});
