import { describe, expect, it } from 'vitest';
import { AttendanceRecordNoShowNoted } from '@/contexts/scheduling/domain/events/attendance-record-no-show-noted.event';

describe('AttendanceRecordNoShowNoted', () => {
  it('is named after the context, the aggregate and the fact', () => {
    const event = new AttendanceRecordNoShowNoted('practice-1.patient-1', new Date('2026-01-01T00:00:00.000Z'), {
      appointmentId: 'appointment-1',
      startsAt: new Date('2025-12-31T09:00:00.000Z'),
    });

    expect(event.name).toBe('scheduling.attendance-record.no-show-noted');
    expect(event.aggregateId).toBe('practice-1.patient-1');
  });
});
