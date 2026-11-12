import { EntitySchema } from 'typeorm';
import type { CriteriaContractRow } from '@ddd-ts-kit/testing/contracts';
import { readModelColumns, type ReadModelStamps } from '../../../src';

const INSTANT = { type: 'timestamp with time zone', precision: 3 } as const;

/** What a live row always holds, which the columns no longer say: a deleted row keeps its key and its stamp alone. */
const LIVE_ROWS =
  'deleted or (status is not null and title is not null and seats is not null and price is not null and starts_at is not null and remote is not null and tenant_id is not null)';

/**
 * The read model of the contracts. The text column that is ordered takes the "C" collation. Every
 * column of the row is nullable, which is what a deleted row holds there, and the check constraint
 * keeps the live rows whole. `remote` has a default, which a deleted row does not take.
 */
export const contractRows = new EntitySchema<CriteriaContractRow & ReadModelStamps>({
  name: 'CriteriaContractRow',
  tableName: 'criteria_contract',
  schema: 'read_side',
  columns: {
    id: { type: 'text', primary: true },
    status: { type: 'text', nullable: true },
    title: { type: 'text', nullable: true },
    seats: { type: 'int', nullable: true },
    price: { type: 'numeric', nullable: true },
    startsAt: { ...INSTANT, name: 'starts_at', nullable: true },
    cancelledAt: { ...INSTANT, name: 'cancelled_at', nullable: true },
    room: { type: 'text', nullable: true, collation: 'C' },
    remote: { type: 'boolean', nullable: true, default: false },
    tenantId: { name: 'tenant_id', type: 'text', nullable: true },
    ...readModelColumns(),
  },
  indices: [
    { name: 'criteria_contract_tenant_starts_idx', columns: ['tenantId', 'startsAt', 'id'] },
    { name: 'criteria_contract_title_key', columns: ['title'], unique: true },
  ],
  checks: [{ name: 'criteria_contract_live_rows', expression: LIVE_ROWS }],
});
