import { defineCriteria } from '../../src/index.js';

export interface AppointmentRow {
  readonly id: string;
  readonly status: 'booked' | 'cancelled';
  readonly seats: number;
  readonly startsAt: Date;
  readonly room: string | null;
  readonly remote: boolean;
  readonly tenantId: string;
}

export const appointments = defineCriteria<AppointmentRow>({
  fields: {
    id: { type: 'string', filter: ['in'] },
    status: { type: 'string', filter: ['eq', 'in', 'contains'], sortable: true },
    seats: { type: 'number', filter: ['eq', 'gte', 'between', 'in'], sortable: true },
    startsAt: { type: 'instant', filter: ['gte'], sortable: true },
    room: { type: 'string', filter: ['isNull', 'eq'], sortable: true, nullable: true },
    tenantId: { type: 'string' },
  },
  defaultSort: [{ field: 'startsAt', direction: 'desc' }],
  tieBreaker: 'id',
  limits: { maxPageSize: 50, maxInList: 3, maxFilters: 4 },
});

export const row = (id: string, more: Partial<AppointmentRow> = {}): AppointmentRow => ({
  id,
  status: 'booked',
  seats: 1,
  startsAt: new Date('2026-10-01T08:00:00Z'),
  room: null,
  remote: false,
  tenantId: 'acme',
  ...more,
});
