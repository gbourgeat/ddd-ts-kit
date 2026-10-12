import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { KnexContext, KnexReadModelStore } from '@ddd-ts-kit/knex';
import {
  OutcomeRegister,
  outcomeCriteria,
  type Outcome,
} from '@/contexts/analytics/application/ports/outcome-register.port';
import { ANALYTICS_SCHEMA } from '@/contexts/analytics/infrastructure/persistence/analytics.schema';

@Repository(OutcomeRegister, [KnexContext])
export class KnexOutcomeRegister extends KnexReadModelStore<Outcome> implements OutcomeRegister {
  constructor(context: KnexContext) {
    super(context, {
      schema: ANALYTICS_SCHEMA,
      table: 'outcomes',
      columns: {
        id: 'id',
        practiceId: 'practice_id',
        calendarId: 'calendar_id',
        day: 'day',
        startsAt: 'starts_at',
        endsAt: 'ends_at',
        state: 'state',
        changedAt: 'changed_at',
      },
      definition: outcomeCriteria,
    });
  }
}
