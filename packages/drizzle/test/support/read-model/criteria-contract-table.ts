import { sql } from 'drizzle-orm';
import { boolean, check, customType, integer, numeric, pgSchema, text, uniqueIndex } from 'drizzle-orm/pg-core';
import type { CriteriaContractRow } from '@ddd-ts-kit/testing/contracts';
import { readModelColumns, type DrizzleReadModelOptions } from '../../../src/postgres';
import { instant } from '../../../src/postgres/columns/instant';

/** A text column ordered by code point, as criteria order strings. */
const binaryText = customType<{ data: string }>({ dataType: () => 'text collate "C"' });

/** What a live row always holds, which the columns no longer say: a deleted row keeps its key and its stamp alone. */
const LIVE_ROWS = sql`deleted or (status is not null and title is not null and seats is not null and price is not null and starts_at is not null and remote is not null and tenant_id is not null)`;

/**
 * Every column of the row accepts NULL, which is what a deleted row holds there, and the check
 * constraint keeps the live rows whole. `remote` has a default, which a deleted row does not take.
 */
export const contractRows = pgSchema('read_side').table(
  'criteria_contract',
  {
    id: text('id').primaryKey(),
    status: text('status'),
    title: text('title'),
    seats: integer('seats'),
    price: numeric('price'),
    startsAt: instant('starts_at'),
    cancelledAt: instant('cancelled_at'),
    room: binaryText('room'),
    remote: boolean('remote').default(false),
    tenantId: text('tenant_id'),
    ...readModelColumns(),
  },
  (table) => [
    uniqueIndex('criteria_contract_title_key').on(table.title),
    check('criteria_contract_live_rows', LIVE_ROWS),
  ],
);

export const CONTRACT_TABLE: DrizzleReadModelOptions<CriteriaContractRow> = {
  table: contractRows,
  key: contractRows.id,
  columns: {
    id: contractRows.id,
    status: contractRows.status,
    title: contractRows.title,
    seats: contractRows.seats,
    price: contractRows.price,
    startsAt: contractRows.startsAt,
    cancelledAt: contractRows.cancelledAt,
    room: contractRows.room,
    remote: contractRows.remote,
    tenantId: contractRows.tenantId,
  },
};
