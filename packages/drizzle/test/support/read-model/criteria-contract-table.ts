import { boolean, customType, integer, numeric, pgSchema, text } from 'drizzle-orm/pg-core';
import type { CriteriaContractRow } from '@ddd-ts-kit/testing/contracts';
import { readModelColumns, type DrizzleReadModelOptions } from '../../../src/postgres';
import { instant } from '../../../src/postgres/columns/instant';

/** A text column ordered by code point, as criteria order strings. */
const binaryText = customType<{ data: string }>({ dataType: () => 'text collate "C"' });

export const contractRows = pgSchema('read_side').table('criteria_contract', {
  id: text('id').primaryKey(),
  status: text('status').notNull(),
  title: text('title').notNull(),
  seats: integer('seats').notNull(),
  price: numeric('price').notNull(),
  startsAt: instant('starts_at').notNull(),
  cancelledAt: instant('cancelled_at'),
  room: binaryText('room'),
  remote: boolean('remote').notNull(),
  tenantId: text('tenant_id').notNull(),
  ...readModelColumns(),
});

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
