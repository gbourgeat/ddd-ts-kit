import { beforeEach, describe, expect, it } from 'vitest';
import { CommandBus } from '@ddd-ts-kit/kernel';
import { createApplication, defineContextModule, kernelModule, override } from '../src';
import { wiringFailure } from './support/failure';
import { PlaceOrder } from './support/ordering/application/commands/place-order/place-order.command';
import { PlaceOrderHandler } from './support/ordering/application/commands/place-order/place-order.handler';
import { GetOrder } from './support/ordering/application/queries/get-order/get-order.query';
import { GetOrderHandler } from './support/ordering/application/queries/get-order/get-order.handler';
import { OrderRepository } from './support/ordering/domain/repositories/order.repository';
import { InMemoryOrderRepository } from './support/ordering/infrastructure/persistence/in-memory-order.repository';
import { orderingModule } from './support/ordering/ordering.module';
import { deterministicKernel } from './support/deterministic-kernel';

beforeEach(() => {
  PlaceOrderHandler.built = 0;
});

describe('what a handler needs', () => {
  it('rejects a handler dependency that no module binds, before any message', () => {
    const error = wiringFailure(() => createApplication({ modules: [orderingModule] }));

    expect(error.code).toBe('UNBOUND_DEPENDENCY');
    expect(error.message).toContain('"PlaceOrderHandler"');
  });

  it('asks for the kernel module when handlers have no bus to go on', () => {
    const lonely = defineContextModule({
      name: 'lonely',
      register(builder) {
        builder.bind(OrderRepository).toClass(InMemoryOrderRepository);
        builder.query(GetOrder).handledBy(GetOrderHandler, [OrderRepository]);
      },
    });

    const error = wiringFailure(() => createApplication({ modules: [lonely] }));

    expect(error.code).toBe('UNBOUND_DEPENDENCY');

    expect(error.message).toBe(
      'Module "lonely" declares the query "GetOrder", but no module binds "QueryBus". Add kernelModule() to the modules.',
    );
  });

  it('rejects a bus that cannot receive handlers', () => {
    const remote: CommandBus = { execute: () => Promise.reject(new Error('remote transport')) };

    const error = wiringFailure(() =>
      createApplication({
        modules: [deterministicKernel(), orderingModule],
        overrides: [override(CommandBus, remote)],
      }),
    );

    expect(error.code).toBe('BUS_WITHOUT_REGISTER');
    expect(error.message).toContain('"CommandBus" has no register(type, handler) method');
  });

  it('rejects a command left without a handler', () => {
    const sloppy = defineContextModule({ name: 'sloppy', register: (builder) => void builder.command(PlaceOrder) });

    const error = wiringFailure(() => createApplication({ modules: [kernelModule(), sloppy] }));

    expect(error.code).toBe('INCOMPLETE_BINDING');
    expect(error.message).toContain('command(PlaceOrder) without handledBy or handledByFactory');
  });
});
