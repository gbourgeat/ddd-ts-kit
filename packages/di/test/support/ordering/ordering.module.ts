import { Clock, IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { defineContextModule } from '../../../src';
import { CancelOrder } from './application/commands/cancel-order/cancel-order.command';
import { CancelOrderHandler } from './application/commands/cancel-order/cancel-order.handler';
import { PlaceOrder } from './application/commands/place-order/place-order.command';
import { PlaceOrderHandler } from './application/commands/place-order/place-order.handler';
import { GetOrder } from './application/queries/get-order/get-order.query';
import { GetOrderHandler } from './application/queries/get-order/get-order.handler';
import { OrderRepository } from './domain/repositories/order.repository';
import { InMemoryOrderRepository } from './infrastructure/persistence/in-memory-order.repository';

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
