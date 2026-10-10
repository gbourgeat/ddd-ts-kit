import { bigint, boolean, text } from 'drizzle-orm/pg-core';
import { instant } from '../columns/instant.js';

/**
 * The columns a projection orders its events by, to spread into the table of a read model,
 * under the same names in every project: `last_event_id`, `last_event_at`,
 * `last_event_version` and `deleted`, the trace a removed row leaves so that a late event does
 * not bring it back.
 */
export function readModelColumns() {
  return {
    lastEventId: text('last_event_id').notNull(),
    lastEventAt: instant('last_event_at').notNull(),
    lastEventVersion: bigint('last_event_version', { mode: 'number' }),
    deleted: boolean('deleted').notNull().default(false),
  };
}
