import { Clock, IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { defineContextModule } from '../../../src/index.js';
import { CancelOrder } from './application/commands/cancel-order/cancel-order.command.js';
import { CancelOrderHandler } from './application/commands/cancel-order/cancel-order.handler.js';
import { PlaceOrder } from './application/commands/place-order/place-order.command.js';
import { PlaceOrderHandler } from './application/commands/place-order/place-order.handler.js';
import { GetOrder } from './application/queries/get-order/get-order.query.js';
import { GetOrderHandler } from './application/queries/get-order/get-order.handler.js';
import { OrderRepository } from './domain/repositories/order.repository.js';
import { InMemoryOrderRepository } from './infrastructure/persistence/in-memory-order.repository.js';

/** A context written in the explicit style: one module, no decorator on any class. */
export const orderingModule = defineContextModule({
  name: 'ordering',
  register(builder) {
    builder.bind(OrderRepository).toClass(InMemoryOrderRepository).as('repository');

    builder
      .command(PlaceOrder)
      .handledBy(PlaceOrderHandler, [OrderRepository, IntegrationEventPublisher, IdGenerator, Clock]);

    builder.command(CancelOrder).handledBy(CancelOrderHandler, [OrderRepository]);
    builder.query(GetOrder).handledBy(GetOrderHandler, [OrderRepository]);
  },
});
