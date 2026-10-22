import { defineCriteria, type CriteriaDefinition } from '@ddd-ts-kit/kernel';
import type { CriteriaContractRow } from './criteria-contract-row';

/** What the read port of the contract accepts: every operator of every type, groups two deep. */
export const criteriaContractDefinition: CriteriaDefinition<CriteriaContractRow> = defineCriteria<CriteriaContractRow>({
  fields: {
    id: { type: 'string', filter: ['eq', 'in'] },
    status: { type: 'string', filter: ['eq', 'ne', 'in'], sortable: true },
    title: { type: 'string', filter: ['eq', 'ne', 'in', 'contains', 'startsWith'] },
    seats: { type: 'number', filter: ['eq', 'ne', 'in', 'gt', 'gte', 'lt', 'lte', 'between'], sortable: true },
    price: { type: 'decimal', filter: ['eq', 'ne', 'in', 'gt', 'gte', 'lt', 'lte', 'between'], sortable: true },
    startsAt: { type: 'instant', filter: ['eq', 'in', 'gt', 'gte', 'lt', 'lte', 'between'], sortable: true },
    cancelledAt: { type: 'instant', filter: ['isNull', 'gte', 'lt'], sortable: true, nullable: true },
    room: { type: 'string', filter: ['eq', 'ne', 'in', 'isNull', 'gt'], sortable: true, nullable: true },
    remote: { type: 'boolean', filter: ['eq', 'ne'], sortable: true },
    tenantId: { type: 'string', filter: ['eq'] },
  },
  defaultSort: [{ field: 'startsAt', direction: 'asc' }],
  tieBreaker: 'id',
  limits: { maxDepth: 2 },
});
