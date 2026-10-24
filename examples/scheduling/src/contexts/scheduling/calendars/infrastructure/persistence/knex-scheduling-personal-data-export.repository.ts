import type { ExecutionScope } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { KnexContext, KnexPersonalDataExport } from '@ddd-ts-kit/knex';
import { SchedulingPersonalDataExport } from '@/contexts/scheduling/calendars/application/ports/scheduling-personal-data-export.port';
import { AgendaPersonalFields } from '@/contexts/scheduling/calendars/infrastructure/persistence/agenda.personal-fields';
import { AppointmentPersonalFields } from '@/contexts/scheduling/calendars/infrastructure/persistence/appointment.personal-fields';
import { PractitionerPersonalFields } from '@/contexts/scheduling/calendars/infrastructure/persistence/practitioner.personal-fields';

/**
 * The export of scheduling, as its declarations say: the notes, the cancellation reasons and the
 * documents of the appointments of the patient (a document by its key), the agenda, and the name
 * of the directory, in the network of the work alone.
 */
@Repository(SchedulingPersonalDataExport)
export class KnexSchedulingPersonalDataExport extends KnexPersonalDataExport implements SchedulingPersonalDataExport {
  constructor(database: KnexContext, scope: ExecutionScope) {
    super(database, {
      name: 'scheduling',
      declarations: [
        // ddd-ts-kit:personal-fields
        AppointmentPersonalFields,
        AgendaPersonalFields,
        PractitionerPersonalFields,
        // /ddd-ts-kit:personal-fields
      ],
      tenant: scope,
    });
  }
}
