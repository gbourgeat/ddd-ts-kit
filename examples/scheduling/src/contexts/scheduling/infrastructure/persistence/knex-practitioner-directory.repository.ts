import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { KnexContext, KnexReadModelStore } from '@ddd-ts-kit/knex';
import {
  PractitionerDirectory,
  practitionerCriteria,
  type PractitionerEntry,
} from '#src/contexts/scheduling/application/ports/practitioner-directory.port.js';
import { SCHEDULING_SCHEMA } from '#src/contexts/scheduling/infrastructure/persistence/scheduling.schema.js';

@Repository(PractitionerDirectory, [KnexContext])
export class KnexPractitionerDirectory extends KnexReadModelStore<PractitionerEntry> implements PractitionerDirectory {
  constructor(context: KnexContext) {
    super(context, {
      schema: SCHEDULING_SCHEMA,
      table: 'practitioners',
      columns: {
        id: 'id',
        practiceId: 'practice_id',
        practitionerId: 'practitioner_id',
        displayName: 'display_name',
        timeZone: 'time_zone',
      },
      definition: practitionerCriteria,
    });
  }
}
