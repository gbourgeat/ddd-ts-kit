import { ReadModelStore, defineCriteria } from '@ddd-ts-kit/kernel';

export interface CustomerOrdersRow {
  readonly customerId: string;
  readonly orders: number;
  readonly lastOrderId: string;
}

export const customerOrdersCriteria = defineCriteria<CustomerOrdersRow>({
  fields: {
    customerId: { type: 'string', filter: ['eq', 'in'] },
    orders: { type: 'number', filter: ['gte'], sortable: true },
    lastOrderId: { type: 'string' },
  },
  defaultSort: [{ field: 'orders', direction: 'desc' }],
  tieBreaker: 'customerId',
});

/** The read model of the projection: how many orders each customer placed. */
export abstract class CustomerOrders extends ReadModelStore<CustomerOrdersRow> {}
