import { RelationTupleStore } from '@ddd-ts-kit/auth/rebac';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { SchedulingRelationships } from '@/contexts/scheduling/application/ports/scheduling-relationships.port';

type RecordedCalendar = Parameters<SchedulingRelationships['recordCalendar']>[0];
type RecordedAppointment = Parameters<SchedulingRelationships['recordAppointment']>[0];

/**
 * Writes the relationships as tuples of the store the authorizer reads: a table of this database
 * (ADR-0001), written in the unit of work of the command. A relationship commits or rolls back
 * with the fact it follows, which is why its domain event handlers run before the commit.
 */
@Repository(SchedulingRelationships, [RelationTupleStore])
export class TupleSchedulingRelationships implements SchedulingRelationships {
  constructor(private readonly tuples: RelationTupleStore) {}

  async recordCalendar({ calendarId, practiceId, practitionerId }: RecordedCalendar): Promise<void> {
    const calendar = `calendar:${calendarId}`;

    await this.tuples.write([
      { object: calendar, relation: 'desk', subject: `desk:${practiceId}.${practitionerId}` },
      { object: calendar, relation: 'practice', subject: `practice:${practiceId}` },
    ]);
  }

  async recordAppointment({ appointmentId, calendarId, patientId }: RecordedAppointment): Promise<void> {
    const appointment = `appointment:${appointmentId}`;

    await this.tuples.write([
      { object: appointment, relation: 'patient', subject: `user:${patientId}` },
      { object: appointment, relation: 'calendar', subject: `calendar:${calendarId}` },
    ]);
  }
}
