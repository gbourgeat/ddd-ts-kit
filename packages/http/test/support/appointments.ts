import { defineCriteria } from '@ddd-ts-kit/kernel';

export interface AppointmentRow {
  readonly id: string;
  readonly status: 'booked' | 'confirmed' | 'cancelled';
  readonly title: string;
  readonly seats: number;
  readonly price: string;
  readonly startsAt: Date;
  readonly cancelledAt: Date | null;
  readonly remote: boolean;
  readonly tenantId: string;
}

export const appointments = defineCriteria<AppointmentRow>({
  fields: {
    id: { type: 'string' },
    status: { type: 'string', filter: ['eq', 'ne', 'in'], sortable: true },
    title: { type: 'string', filter: ['eq', 'in', 'contains', 'startsWith'] },
    seats: { type: 'number', filter: ['eq', 'gte', 'lte', 'between', 'in'], sortable: true },
    price: { type: 'decimal', filter: ['gte'] },
    startsAt: { type: 'instant', filter: ['gte', 'lt', 'between'], sortable: true },
    cancelledAt: { type: 'instant', filter: ['isNull'], nullable: true },
    remote: { type: 'boolean', filter: ['eq'] },
    tenantId: { type: 'string' },
  },
  defaultSort: [{ field: 'startsAt', direction: 'asc' }],
  tieBreaker: 'id',
  limits: { maxPageSize: 50, maxInList: 3 },
});
