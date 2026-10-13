import type { ExecutionScope } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { KnexContext, KnexReadModelStore } from '@ddd-ts-kit/knex';
import {
  OutcomeRegister,
  outcomeCriteria,
  type Outcome,
} from '@/contexts/analytics/application/ports/outcome-register.port';
import { ANALYTICS_SCHEMA } from '@/contexts/analytics/infrastructure/persistence/analytics.schema';

@Repository(OutcomeRegister)
export class KnexOutcomeRegister extends KnexReadModelStore<Outcome> implements OutcomeRegister {
  /** Tenant data: every row is written in, and every read confined to, the tenant of the work. */
  constructor(context: KnexContext, scope: ExecutionScope) {
    super(context, {
      tenant: scope,
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
