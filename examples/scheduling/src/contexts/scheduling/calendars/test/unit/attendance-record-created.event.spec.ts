import { describe, expect, it } from 'vitest';
import { AttendanceRecordCreated } from '@/contexts/scheduling/calendars/domain/events/attendance-record-created.event';

describe('AttendanceRecordCreated', () => {
  it('is named after the context, the aggregate and the fact', () => {
    const event = new AttendanceRecordCreated('practice-1.patient-1', new Date('2026-01-01T00:00:00.000Z'), {
      practiceId: 'practice-1',
      patientId: 'patient-1',
    });

    expect(event.name).toBe('scheduling.attendance-record.created');
    expect(event.aggregateId).toBe('practice-1.patient-1');
  });
});
