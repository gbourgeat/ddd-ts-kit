import type { Knex } from 'knex';
import { createKnexUnitOfWork, KnexOutboxStore, KnexProcessedEventStore } from '@ddd-ts-kit/knex';
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';
import { MESSAGING } from '{{alias.platform}}/database/schema{{alias.ext}}';

/** One object is the unit of work and what repositories query through; the stores write in its transaction. */
export function persistenceOver(db: Knex, close: () => Promise<void>): Persistence {
  const unitOfWork = createKnexUnitOfWork(db);

  return {
    unitOfWork,
    database: unitOfWork,
{{#if tenancy.any}}
    outbox: new KnexOutboxStore(unitOfWork, { schema: MESSAGING, tenant: true }),
{{/if}}
{{#unless tenancy.any}}
    outbox: new KnexOutboxStore(unitOfWork, { schema: MESSAGING }),
{{/unless}}
    processedEvents: new KnexProcessedEventStore(unitOfWork, { schema: MESSAGING }),
    close,
  };
}
