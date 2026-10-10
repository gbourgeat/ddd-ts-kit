import { stampOf, type IntegrationEvent, type ReadModelWrite } from '@ddd-ts-kit/kernel';
import { On, Projection } from '@ddd-ts-kit/kernel/declarations';
import { OrderPlaced, type OrderPlacedPayload } from '../../../billing/published-language/order-placed.js';
import { CustomerForgotten } from '../../domain/events/customer-forgotten.event.js';
import { CustomerOrders } from '../ports/customer-orders.port.js';

@Projection('reporting.customer-orders', [CustomerOrders])
export class CustomerOrdersProjection {
  constructor(private readonly customers: CustomerOrders) {}

  @On(OrderPlaced)
  async orderPlaced(event: IntegrationEvent<OrderPlacedPayload>): Promise<ReadModelWrite> {
    const { customerId, orderId } = event.payload;

    return this.customers.upsertIfNewer(customerId, stampOf(event), (customer) => ({ customerId, orders: (customer?.orders ?? 0) + 1, lastOrderId: orderId }));
  }

  @On(CustomerForgotten, { name: 'reporting.customer.forgotten' })
  async forgotten(event: CustomerForgotten): Promise<ReadModelWrite> {
    return this.customers.delete(event.aggregateId, stampOf(event));
  }
}
