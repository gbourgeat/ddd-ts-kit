import { EntitySchema } from 'typeorm';
import type { CriteriaContractRow } from '@ddd-ts-kit/testing/contracts';
import { readModelColumns, type ReadModelStamps } from '../../../src/index.js';

const INSTANT = { type: 'timestamp with time zone', precision: 3 } as const;

/** The read model of the contracts. The text column that is ordered takes the "C" collation. */
export const contractRows = new EntitySchema<CriteriaContractRow & ReadModelStamps>({
  name: 'CriteriaContractRow',
  tableName: 'criteria_contract',
  schema: 'read_side',
  columns: {
    id: { type: 'text', primary: true },
    status: { type: 'text' },
    title: { type: 'text' },
    seats: { type: 'int' },
    price: { type: 'numeric' },
    startsAt: { ...INSTANT, name: 'starts_at' },
    cancelledAt: { ...INSTANT, name: 'cancelled_at', nullable: true },
    room: { type: 'text', nullable: true, collation: 'C' },
    remote: { type: 'boolean' },
    tenantId: { name: 'tenant_id', type: 'text' },
    ...readModelColumns(),
  },
  indices: [{ name: 'criteria_contract_tenant_starts_idx', columns: ['tenantId', 'startsAt', 'id'] }],
});
