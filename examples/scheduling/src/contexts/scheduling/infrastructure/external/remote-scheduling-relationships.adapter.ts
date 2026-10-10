import { RelationTupleStore } from '@ddd-ts-kit/auth/rebac';
import { Adapter } from '@ddd-ts-kit/kernel/declarations';
import { SchedulingRelationships } from '../../application/ports/scheduling-relationships.port.js';
import { ownPolicy } from '../../../../platform/resilience/own-policy.js';

type RecordedCalendar = Parameters<SchedulingRelationships['recordCalendar']>[0];
type RecordedAppointment = Parameters<SchedulingRelationships['recordAppointment']>[0];

/**
 * Writes the relationships as tuples of the store the authorizer reads. The store works in the
 * unit of work of the command, so nothing is retried here: the policy of this adapter is empty.
 */
@Adapter(SchedulingRelationships, { kind: 'external', aspects: [ownPolicy()] }, [RelationTupleStore])
export class RemoteSchedulingRelationships implements SchedulingRelationships {
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
