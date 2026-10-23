import type { ExecutionScope } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { KnexContext, KnexReadModelStore } from '@ddd-ts-kit/knex';
import {
  PractitionerDirectory,
  practitionerCriteria,
  type PractitionerEntry,
} from '@/contexts/scheduling/application/calendars/ports/practitioner-directory.port';
import { SCHEDULING_SCHEMA } from '@/contexts/scheduling/infrastructure/persistence/scheduling.schema';

@Repository(PractitionerDirectory)
export class KnexPractitionerDirectory extends KnexReadModelStore<PractitionerEntry> implements PractitionerDirectory {
  /** Tenant data: every row is written in, and every read confined to, the tenant of the work. */
  constructor(context: KnexContext, scope: ExecutionScope) {
    super(context, {
      tenant: scope,
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
