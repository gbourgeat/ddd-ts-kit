import type { IntegrationEvent, ReadModelStore } from '@ddd-ts-kit/kernel';
import { On, Projection } from '@ddd-ts-kit/kernel/declarations';
import { OrderPlaced, type OrderPlacedPayload } from './billing/published-language/order-placed';
import { CustomerOrders, type CustomerOrdersRow } from './reporting/application/ports/customer-orders.port';

/** Carries the name of the projection of the reporting context. */
@Projection('reporting.customer-orders', [CustomerOrders])
export class Twin {
  constructor(readonly customers: ReadModelStore<CustomerOrdersRow>) {}

  @On(OrderPlaced)
  async placed(_event: IntegrationEvent<OrderPlacedPayload>): Promise<void> {}
}

/** Applies the same event by two methods. */
@Projection('reporting.twice', [CustomerOrders])
export class Twice {
  constructor(readonly customers: ReadModelStore<CustomerOrdersRow>) {}

  @On(OrderPlaced)
  async first(_event: IntegrationEvent<OrderPlacedPayload>): Promise<void> {}

  @On(OrderPlaced)
  async second(_event: IntegrationEvent<OrderPlacedPayload>): Promise<void> {}
}
