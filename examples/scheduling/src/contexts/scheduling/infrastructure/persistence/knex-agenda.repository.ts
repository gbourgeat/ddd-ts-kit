import type { ExecutionScope } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { KnexContext, KnexReadModelStore } from '@ddd-ts-kit/knex';
import { Agenda, agendaCriteria, type AgendaEntry } from '@/contexts/scheduling/application/ports/agenda.port';
import { SCHEDULING_SCHEMA } from '@/contexts/scheduling/infrastructure/persistence/scheduling.schema';

@Repository(Agenda)
export class KnexAgenda extends KnexReadModelStore<AgendaEntry> implements Agenda {
  /** Tenant data: every row is written in, and every read confined to, the tenant of the work. */
  constructor(context: KnexContext, scope: ExecutionScope) {
    super(context, {
      tenant: scope,
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
        internalNote: 'internal_note',
        changedAt: 'changed_at',
      },
      definition: agendaCriteria,
    });
  }
}
