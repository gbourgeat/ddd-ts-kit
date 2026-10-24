import type { ExecutionScope, FileStorage } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { KnexContext, KnexPersonalDataErasure } from '@ddd-ts-kit/knex';
import { SchedulingPersonalDataErasure } from '@/contexts/scheduling/calendars/application/ports/scheduling-personal-data-erasure.port';
import { AgendaPersonalFields } from '@/contexts/scheduling/calendars/infrastructure/persistence/agenda.personal-fields';
import { AppointmentPersonalFields } from '@/contexts/scheduling/calendars/infrastructure/persistence/appointment.personal-fields';
import { PractitionerPersonalFields } from '@/contexts/scheduling/calendars/infrastructure/persistence/practitioner.personal-fields';

/**
 * The erasure of scheduling, as its declarations say: the documents of the patient deleted from
 * the file storage first, then the notes, the cancellation reasons and the name of the directory
 * pseudonymised, in the network of the work alone. Running it again reaches nothing.
 */
@Repository(SchedulingPersonalDataErasure)
export class KnexSchedulingPersonalDataErasure
  extends KnexPersonalDataErasure
  implements SchedulingPersonalDataErasure
{
  constructor(database: KnexContext, scope: ExecutionScope, files: FileStorage) {
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
      files,
    });
  }
}
