import { describe, expect, it } from 'vitest';
import { InMemoryRelationTupleStore, SchemaCheckedTupleStore } from '@ddd-ts-kit/auth/rebac';
import { TupleSchedulingRelationships } from '@/contexts/scheduling/infrastructure/persistence/tuple-scheduling-relationships.repository.js';
import { relationshipSchema } from '@/platform/auth/relationship-schema.js';

const calendar = { calendarId: 'calendar-1', practiceId: 'practice-1', practitionerId: 'practitioner-1' };
const appointment = { appointmentId: 'appointment-1', calendarId: 'calendar-1', patientId: 'patient-1' };

describe('TupleSchedulingRelationships', () => {
  it('relates a calendar to the desk of its practitioner and to its practice, as the relationship schema knows them', async () => {
    const { relationships, tuples } = arrange();

    await relationships.recordCalendar(calendar);

    expect(await tuples.readByObject('calendar:calendar-1', 'desk')).toEqual([
      { object: 'calendar:calendar-1', relation: 'desk', subject: 'desk:practice-1.practitioner-1' },
    ]);

    expect(await tuples.readByObject('calendar:calendar-1', 'practice')).toEqual([
      { object: 'calendar:calendar-1', relation: 'practice', subject: 'practice:practice-1' },
    ]);
  });

  it('relates an appointment to its patient and to its calendar', async () => {
    const { relationships, tuples } = arrange();

    await relationships.recordAppointment(appointment);

    expect(await tuples.readByObject('appointment:appointment-1', 'patient')).toEqual([
      { object: 'appointment:appointment-1', relation: 'patient', subject: 'user:patient-1' },
    ]);

    expect(await tuples.readByObject('appointment:appointment-1', 'calendar')).toEqual([
      { object: 'appointment:appointment-1', relation: 'calendar', subject: 'calendar:calendar-1' },
    ]);
  });

  it('knows nothing more when the same calendar is recorded twice', async () => {
    const { relationships, tuples } = arrange();

    await relationships.recordCalendar(calendar);
    await relationships.recordCalendar(calendar);

    expect(await tuples.readByObject('calendar:calendar-1', 'desk')).toHaveLength(1);
  });
});

function arrange() {
  const tuples = new SchemaCheckedTupleStore(relationshipSchema, new InMemoryRelationTupleStore());

  return { relationships: new TupleSchedulingRelationships(tuples), tuples };
}
