import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { KnexContext, KnexReadModelStore } from '@ddd-ts-kit/knex';
import { Agenda, agendaCriteria, type AgendaEntry } from '../../application/ports/agenda.port.js';
import { SCHEDULING_SCHEMA } from './scheduling.schema.js';

@Repository(Agenda, [KnexContext])
export class KnexAgenda extends KnexReadModelStore<AgendaEntry> implements Agenda {
  constructor(context: KnexContext) {
    super(context, {
      schema: SCHEDULING_SCHEMA,
      table: 'agenda',
      columns: {
        id: 'id',
        calendarId: 'calendar_id',
        practiceId: 'practice_id',
        practitionerId: 'practitioner_id',
        patientId: 'patient_id',
        appointmentTypeId: 'appointment_type_id',
        startsAt: 'starts_at',
        endsAt: 'ends_at',
        heldUntil: 'held_until',
        day: 'day',
        status: 'status',
        confirmBefore: 'confirm_before',
        cancelledBy: 'cancelled_by',
        changedAt: 'changed_at',
      },
      definition: agendaCriteria,
    });
  }
}
