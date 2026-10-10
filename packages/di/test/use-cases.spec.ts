import { beforeEach, describe, expect, it } from 'vitest';
import {
  Clock,
  Command,
  CommandBus,
  EventBus,
  FixedClock,
  IdGenerator,
  InMemoryCommandBus,
  InMemoryQueryBus,
  IntegrationEventPublisher,
  Query,
  QueryBus,
  SequentialIdGenerator,
  UnitOfWork,
} from '@ddd-ts-kit/kernel';
import {
  createApplication,
  defineContextModule,
  kernelModule,
  override,
  overrideForTests,
  type BindingInfo,
} from '../src/index.js';
import { wiringFailure } from './support/failure.js';
import { CancelOrder } from './support/ordering/application/commands/cancel-order/cancel-order.command.js';
import { CancelOrderHandler } from './support/ordering/application/commands/cancel-order/cancel-order.handler.js';
import { PlaceOrder } from './support/ordering/application/commands/place-order/place-order.command.js';
import { PlaceOrderHandler } from './support/ordering/application/commands/place-order/place-order.handler.js';
import { GetOrder } from './support/ordering/application/queries/get-order/get-order.query.js';
import { GetOrderHandler } from './support/ordering/application/queries/get-order/get-order.handler.js';
import { OrderRepository } from './support/ordering/domain/repositories/order.repository.js';
import { InMemoryOrderRepository } from './support/ordering/infrastructure/persistence/in-memory-order.repository.js';
import { orderingModule } from './support/ordering/ordering.module.js';

const deterministicKernel = (): ReturnType<typeof kernelModule> =>
  kernelModule({
    clock: new FixedClock(new Date('2026-05-01T08:00:00.000Z')),
    ids: () => new SequentialIdGenerator('order'),
  });

beforeEach(() => {
  PlaceOrderHandler.built = 0;
});

describe('kernelModule', () => {
  it('binds in-process defaults that handlers can be registered on', () => {
    const app = createApplication({ modules: [kernelModule()] });

    expect(app.resolve(CommandBus)).toBeInstanceOf(InMemoryCommandBus);
    expect(app.resolve(QueryBus)).toBeInstanceOf(InMemoryQueryBus);
    expect(app.resolve(Clock).now()).toBeInstanceOf(Date);
    expect(app.resolve(IdGenerator).next()).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('publishes and subscribes through the event bus unless they are separated', () => {
    const outbox = { publish: async () => {} };
    const together = createApplication({ modules: [kernelModule()] });
    const separated = createApplication({ modules: [kernelModule({ eventPublisher: outbox })] });

    expect(together.resolve(IntegrationEventPublisher)).toBe(together.resolve(EventBus));
    expect(separated.resolve(IntegrationEventPublisher)).toBe(outbox);
  });

  it('takes an instance or a factory for each default', () => {
    const app = createApplication({ modules: [deterministicKernel()] });

    expect(app.resolve(Clock).now()).toEqual(new Date('2026-05-01T08:00:00.000Z'));
    expect(app.resolve(IdGenerator).next()).toBe('order-1');
  });

  it('lets a later module rebind a default, with its dependencies checked', async () => {
    abstract class Database {
      abstract readonly transactions: string[];
    }
    class DatabaseUnitOfWork implements UnitOfWork {
      constructor(private readonly database: Database) {}

      async run<T>(work: () => Promise<T>): Promise<T> {
        this.database.transactions.push('begin');

        const result = await work();

        this.database.transactions.push('commit');

        return result;
      }
    }

    const persistence = defineContextModule({
      name: 'persistence',
      register(builder) {
        builder.bind(Database).toValue({ transactions: [] });
        builder.rebind(UnitOfWork).toClass(DatabaseUnitOfWork, [Database]);
      },
    });

    const app = createApplication({ modules: [kernelModule(), persistence, orderingModule] });

    await app.resolve(CommandBus).execute(new PlaceOrder('book'));

    expect(app.resolve(Database).transactions).toEqual(['begin', 'commit']);
  });

  it('refuses to rebind what no earlier module binds', () => {
    const early = defineContextModule({
      name: 'early',
      register: (builder) => void builder.rebind(Clock).toValue(new FixedClock(new Date(0))),
    });

    const error = wiringFailure(() => createApplication({ modules: [early, kernelModule()] }));

    expect(error.code).toBe('NOTHING_TO_REBIND');

    expect(error.message).toBe(
      'Module "early" rebinds "Clock", which no earlier module binds. List the module that binds it first, or use bind.',
    );
  });
});

describe('commands and queries', () => {
  it('reaches a handler through the bus', async () => {
    const app = createApplication({ modules: [deterministicKernel(), orderingModule] });

    const id = await app.resolve(CommandBus).execute(new PlaceOrder('book'));

    await app.resolve(CommandBus).execute(new CancelOrder(id));

    expect(id).toBe('order-1');

    expect(await app.resolve(QueryBus).execute(new GetOrder(id))).toEqual({
      id: 'order-1',
      sku: 'book',
      placedAt: new Date('2026-05-01T08:00:00.000Z'),
      cancelled: true,
    });
  });

  it('builds a handler on its first message, once', async () => {
    const app = createApplication({ modules: [deterministicKernel(), orderingModule] });

    expect(PlaceOrderHandler.built).toBe(0);

    await app.resolve(CommandBus).execute(new PlaceOrder('book'));
    await app.resolve(CommandBus).execute(new PlaceOrder('pen'));

    expect(PlaceOrderHandler.built).toBe(1);
  });

  it('binds a handler class under itself: the one the bus runs is the one the application resolves', async () => {
    const app = createApplication({ modules: [deterministicKernel(), orderingModule] });

    await app.resolve(CommandBus).execute(new PlaceOrder('book'));

    expect(app.resolve(PlaceOrderHandler)).toBeInstanceOf(PlaceOrderHandler);
    expect(PlaceOrderHandler.built).toBe(1);
  });

  it('hands handlers to the decorate hook as use cases of their module', async () => {
    const seen: BindingInfo[] = [];

    const app = createApplication({
      modules: [deterministicKernel(), orderingModule],
      decorate: (instance, info) => {
        seen.push(info);

        return instance;
      },
    });

    await app.resolve(QueryBus).execute(new GetOrder('order-1'));

    expect(seen).toContainEqual({ token: GetOrderHandler, context: 'ordering', kind: 'use-case' });
  });
});

describe('a handler built by a factory', () => {
  it('takes a factory when a constructor is not enough, bound under a class made for the statement', async () => {
    class Ping extends Query<string> {}

    const health = defineContextModule({
      name: 'health',
      register(builder) {
        builder.query(Ping).handledByFactory((resolve) => ({ execute: async () => typeof resolve(Clock).now() }));
      },
    });

    const app = createApplication({ modules: [kernelModule(), health] });

    expect(await app.resolve(QueryBus).execute(new Ping())).toBe('object');
    expect(app.describe().queries).toEqual([{ message: 'Ping', handler: 'query(Ping) handler', module: 'health' }]);

    expect(app.describe().bindings).toContainEqual({
      token: 'query(Ping) handler',
      module: 'health',
      kind: 'use-case',
      lifetime: 'singleton',
      source: 'factory',
      dependencies: [],
      overridden: false,
    });
  });

  it('rejects the execution when the handler cannot be built', async () => {
    class Broken extends Command {}
    abstract class Missing {
      abstract readonly text: string;
    }

    const broken = defineContextModule({
      name: 'broken',
      register(builder) {
        builder.command(Broken).handledByFactory((resolve) => {
          resolve(Missing);

          return { execute: async () => {} };
        });
      },
    });

    const app = createApplication({ modules: [kernelModule(), broken] });

    await expect(app.resolve(CommandBus).execute(new Broken())).rejects.toMatchObject({
      code: 'UNBOUND_TOKEN',
      message: 'No module binds "Missing", required by "command(Broken) handler".',
    });
  });

  it('moves the handlers to a bus swapped in after creation', async () => {
    const app = createApplication({ modules: [deterministicKernel(), orderingModule] });
    const replacement = new InMemoryCommandBus();

    overrideForTests(app, CommandBus, replacement);

    await expect(replacement.execute(new PlaceOrder('book'))).resolves.toBe('order-1');
  });
});

describe('the checks on commands and queries', () => {
  it('rejects a command handled twice, naming both modules', () => {
    const duplicate = defineContextModule({
      name: 'archive',
      register: (builder) => builder.command(CancelOrder).handledBy(CancelOrderHandler, [OrderRepository]),
    });

    const error = wiringFailure(() => createApplication({ modules: [kernelModule(), orderingModule, duplicate] }));

    expect(error.code).toBe('DUPLICATE_HANDLER');

    expect(error.message).toBe(
      'The command "CancelOrder" has two handlers: "CancelOrderHandler" in module "ordering" and "CancelOrderHandler" in module "archive".',
    );
  });

  it('rejects a handler class given to two statements: one class is one binding', () => {
    class Archive extends Command {}
    class Purge extends Command {}
    class RetentionHandler {
      async execute(_command: Archive | Purge): Promise<void> {}
    }

    const retention = defineContextModule({
      name: 'retention',
      register(builder) {
        builder.command(Archive).handledBy(RetentionHandler);
        builder.command(Purge).handledBy(RetentionHandler);
      },
    });

    const error = wiringFailure(() => createApplication({ modules: [kernelModule(), retention] }));

    expect(error.code).toBe('DUPLICATE_BINDING');
    expect(error.message).toBe('Token "RetentionHandler" is bound twice: by module "retention" and by module "retention".');
  });

  it('accepts one factory per statement where one class would serve two messages', async () => {
    class Archive extends Command<string> {}
    class Purge extends Command<string> {}
    class RetentionHandler {
      async execute(command: Archive | Purge): Promise<string> {
        return command.constructor.name;
      }
    }
    const shared = new RetentionHandler();

    const retention = defineContextModule({
      name: 'retention',
      register(builder) {
        builder.command(Archive).handledByFactory(() => shared);
        builder.command(Purge).handledByFactory(() => shared);
      },
    });

    const app = createApplication({ modules: [kernelModule(), retention] });

    expect(await app.resolve(CommandBus).execute(new Archive())).toBe('Archive');
    expect(await app.resolve(CommandBus).execute(new Purge())).toBe('Purge');
  });
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
      createApplication({ modules: [deterministicKernel(), orderingModule], overrides: [override(CommandBus, remote)] }),
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
