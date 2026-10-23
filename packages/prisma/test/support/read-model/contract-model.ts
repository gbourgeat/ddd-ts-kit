import type { CriteriaContractRow } from '@ddd-ts-kit/testing/contracts';
import type { PrismaReadModelOptions } from '../../../src';
import type { Prisma } from '../../generated/client/client';

export const CONTRACT_MODEL: PrismaReadModelOptions<CriteriaContractRow, Prisma.TransactionClient> = {
  delegate: (client) => client.criteriaContractRow,
  schema: 'read_side',
  table: 'criteria_contract',
  columns: {
    id: 'id',
    status: 'status',
    title: 'title',
    seats: 'seats',
    price: 'price',
    startsAt: 'starts_at',
    cancelledAt: 'cancelled_at',
    room: 'room',
    remote: 'remote',
    tenantId: 'tenant_id',
  },
};
