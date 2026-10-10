import { describe, expect, it } from 'vitest';
import { Clock, FixedClock, IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { createApplication, defineContextModule, fake, override } from '../src/index.js';
import { CancelOrder } from './support/ordering/application/commands/cancel-order/cancel-order.command.js';
import { CancelOrderHandler } from './support/ordering/application/commands/cancel-order/cancel-order.handler.js';
import { PlaceOrder } from './support/ordering/application/commands/place-order/place-order.command.js';
import { PlaceOrderHandler } from './support/ordering/application/commands/place-order/place-order.handler.js';
import { GetOrder } from './support/ordering/application/queries/get-order/get-order.query.js';
import { GetOrderHandler } from './support/ordering/application/queries/get-order/get-order.handler.js';
import { OrderRepository } from './support/ordering/domain/repositories/order.repository.js';
import { InMemoryOrderRepository } from './support/ordering/infrastructure/persistence/in-memory-order.repository.js';
import { EpochClock } from './support/shop/epoch-clock.js';
import { platform } from './support/shop/platform.module.js';
import { ReserveStock } from './support/shop/reserve-stock.js';
import { Stock } from './support/shop/stock.port.js';

/** Nothing here runs: each statement is a mistake the compiler must refuse, checked with the test sources. */

class StockWithoutCount {
  async reserve(): Promise<void> {}
}

describe('what the compiler refuses of a binding', () => {
  it('toClass: an adapter that does not implement the port, and a wrong dependency list', () => {
    const module = defineContextModule({
      name: 'typed',
      register(builder) {
        // @ts-expect-error the class must implement every member of the port: `reserved` is missing
        builder.bind(Stock).toClass(StockWithoutCount);
        // @ts-expect-error a clock is not a stock
        builder.bind(Stock).toClass(EpochClock);
        // @ts-expect-error the second dependency must be the port of the second parameter: an id generator is no clock
        builder.bind(ReserveStock).toClass(ReserveStock, [Stock, IdGenerator]);
        // @ts-expect-error the list follows the order of the constructor parameters
        builder.bind(ReserveStock).toClass(ReserveStock, [Clock, Stock]);
        // @ts-expect-error a constructor with parameters needs its dependency list
        builder.bind(ReserveStock).toClass(ReserveStock);
        // @ts-expect-error one dependency too many
        builder.bind(ReserveStock).toClass(ReserveStock, [Stock, Clock, IdGenerator]);
        // @ts-expect-error one dependency short
        builder.bind(ReserveStock).toClass(ReserveStock, [Stock]);
        // @ts-expect-error the list names the port, not the in-memory class that implements it
        builder.bind(CancelOrderHandler).toClass(CancelOrderHandler, [InMemoryOrderRepository]);
        // @ts-expect-error a constructor without parameter takes no dependency
        builder.bind(Clock).toClass(EpochClock, [Stock]);
      },
    });

    expect(module.name).toBe('typed');
  });

  it('toValue, override and fake: a value that does not implement the port', () => {
    const module = defineContextModule({
      name: 'typed',
      register(builder) {
        // @ts-expect-error the value must have the shape of the port
        builder.bind(Clock).toValue({ today: () => new Date(0) });
        // @ts-expect-error a string is not a clock
        builder.bind(Clock).toValue('noon');
        // @ts-expect-error a factory answers the port
        builder.bind(Clock).toFactory(() => new InMemoryOrderRepository());
      },
    });

    // @ts-expect-error an override must have the shape of the port
    const overridden = override(Clock, 12);
    // @ts-expect-error a clock is not an order repository
    const mismatched = fake(OrderRepository, new FixedClock(new Date(0)));
    // @ts-expect-error a fake implements every member of the port: `findById` is missing
    const partial = fake(OrderRepository, { save: async () => {} });
    const resolved: Clock = createApplication({ modules: [platform] }).resolve(Clock);

    expect(module.name).toBe('typed');
    expect([overridden[0], mismatched[0], partial[0]]).toEqual([Clock, OrderRepository, OrderRepository]);
    expect(resolved.now()).toEqual(new Date(0));
  });
});

describe('what the compiler refuses of a use case statement', () => {
  it('handledBy: a wrong handler and a wrong dependency list', () => {
    const module = defineContextModule({
      name: 'typed',
      register(builder) {
        // @ts-expect-error CancelOrderHandler does not handle PlaceOrder
        builder.command(PlaceOrder).handledBy(CancelOrderHandler, [OrderRepository]);
        // @ts-expect-error a query handler answering another result type is not its handler
        builder.query(GetOrder).handledByFactory(() => ({ execute: async () => 42 }));

        builder
          .command(PlaceOrder)
          // @ts-expect-error the list follows the order of the constructor parameters
          .handledBy(PlaceOrderHandler, [OrderRepository, IntegrationEventPublisher, Clock, IdGenerator]);

        // @ts-expect-error a constructor with parameters needs its dependency list
        builder.query(GetOrder).handledBy(GetOrderHandler);
        // @ts-expect-error a clock is not the order repository the handler takes
        builder.query(GetOrder).handledBy(GetOrderHandler, [Clock]);
        // @ts-expect-error one dependency too many
        builder.query(GetOrder).handledBy(GetOrderHandler, [OrderRepository, Clock]);
        // @ts-expect-error the list names the port, not the in-memory class that implements it
        builder.command(CancelOrder).handledBy(CancelOrderHandler, [InMemoryOrderRepository]);
      },
    });

    expect(module.name).toBe('typed');
  });
});
