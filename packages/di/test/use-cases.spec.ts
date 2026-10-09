import { beforeEach, describe, expect, it } from 'vitest';
import {
  Command,
  FixedClock,
  InMemoryCommandBus,
  InMemoryQueryBus,
  Query,
  SequentialIdGenerator,
  type CommandBus,
  type UnitOfWork,
} from '@ddd-ts-kit/kernel';
import {
  CLOCK,
  COMMAND_BUS,
  EVENT_BUS,
  EVENT_PUBLISHER,
  ID_GENERATOR,
  QUERY_BUS,
  UNIT_OF_WORK,
  createApplication,
  defineContextModule,
  kernelModule,
  override,
  overrideForTests,
  token,
  type BindingInfo,
} from '../src/index.js';
import { wiringFailure } from './support/failure.js';
import {
  CancelOrder,
  CancelOrderHandler,
  GetOrder,
  GetOrderHandler,
  InMemoryOrderRepository,
  ORDER_REPOSITORY,
  PlaceOrder,
  PlaceOrderHandler,
  orderingModule,
} from './support/ordering.js';

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

    expect(app.resolve(COMMAND_BUS)).toBeInstanceOf(InMemoryCommandBus);
    expect(app.resolve(QUERY_BUS)).toBeInstanceOf(InMemoryQueryBus);
    expect(app.resolve(CLOCK).now()).toBeInstanceOf(Date);
    expect(app.resolve(ID_GENERATOR).next()).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('publishes and subscribes through the event bus unless they are separated', () => {
    const outbox = { publish: async () => {} };
    const together = createApplication({ modules: [kernelModule()] });
    const separated = createApplication({ modules: [kernelModule({ eventPublisher: outbox })] });

    expect(together.resolve(EVENT_PUBLISHER)).toBe(together.resolve(EVENT_BUS));
    expect(separated.resolve(EVENT_PUBLISHER)).toBe(outbox);
  });

  it('takes an instance or a factory for each default', () => {
    const app = createApplication({ modules: [deterministicKernel()] });

    expect(app.resolve(CLOCK).now()).toEqual(new Date('2026-05-01T08:00:00.000Z'));
    expect(app.resolve(ID_GENERATOR).next()).toBe('order-1');
  });

  it('lets a later module rebind a default, with its dependencies checked', async () => {
    class Database {
      readonly transactions: string[] = [];
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
    const DATABASE = token<Database>('platform.Database');
    const persistence = defineContextModule({
      name: 'persistence',
      register(builder) {
        builder.bind(DATABASE).toClass(Database);
        builder.rebind(UNIT_OF_WORK).toClass(DatabaseUnitOfWork, [DATABASE]);
      },
    });

    const app = createApplication({ modules: [kernelModule(), persistence, orderingModule] });

    await app.resolve(COMMAND_BUS).execute(new PlaceOrder('book'));

    expect(app.resolve(DATABASE).transactions).toEqual(['begin', 'commit']);
  });

  it('refuses to rebind what no earlier module binds', () => {
    const early = defineContextModule({
      name: 'early',
      register: (builder) => void builder.rebind(CLOCK).toValue(new FixedClock(new Date(0))),
    });

    const error = wiringFailure(() => createApplication({ modules: [early, kernelModule()] }));

    expect(error.code).toBe('NOTHING_TO_REBIND');
    expect(error.message).toContain('"early"');
    expect(error.message).toContain('"kernel.Clock"');
  });
});

describe('commands and queries', () => {
  it('reaches a handler through the bus, never by resolving it', async () => {
    const app = createApplication({ modules: [deterministicKernel(), orderingModule] });

    const id = await app.resolve(COMMAND_BUS).execute(new PlaceOrder('book'));
    await app.resolve(COMMAND_BUS).execute(new CancelOrder(id));

    expect(id).toBe('order-1');
    expect(await app.resolve(QUERY_BUS).execute(new GetOrder(id))).toEqual({
      id: 'order-1',
      sku: 'book',
      placedAt: new Date('2026-05-01T08:00:00.000Z'),
      cancelled: true,
    });
  });

  it('builds a handler on its first message, once', async () => {
    const app = createApplication({ modules: [deterministicKernel(), orderingModule] });
    expect(PlaceOrderHandler.built).toBe(0);

    await app.resolve(COMMAND_BUS).execute(new PlaceOrder('book'));
    await app.resolve(COMMAND_BUS).execute(new PlaceOrder('pen'));

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

    await app.resolve(QUERY_BUS).execute(new GetOrder('order-1'));

    expect(seen.map(({ token, context, kind }) => [token.description, context, kind])).toContainEqual([
      'GetOrderHandler',
      'ordering',
      'use-case',
    ]);
  });

  it('takes a factory when a constructor is not enough', async () => {
    class Ping extends Query<string> {}
    const app = createApplication({
      modules: [
        kernelModule(),
        defineContextModule({
          name: 'health',
          register(builder) {
            builder
              .query(Ping)
              .handledByFactory((resolve) => ({ execute: async () => typeof resolve(CLOCK).now() }));
          },
        }),
      ],
    });

    expect(await app.resolve(QUERY_BUS).execute(new Ping())).toBe('object');
    expect(app.describe().queries).toEqual([
      { message: 'Ping', handler: 'query(Ping) handler', module: 'health' },
    ]);
  });

  it('rejects the execution when the handler cannot be built', async () => {
    class Broken extends Command {}
    const MISSING = token<string>('Missing');
    const app = createApplication({
      modules: [
        kernelModule(),
        defineContextModule({
          name: 'broken',
          register(builder) {
            builder.command(Broken).handledByFactory((resolve) => {
              resolve(MISSING);
              return { execute: async () => {} };
            });
          },
        }),
      ],
    });

    await expect(app.resolve(COMMAND_BUS).execute(new Broken())).rejects.toMatchObject({
      code: 'UNBOUND_TOKEN',
    });
  });

  it('moves the handlers to a bus swapped in after creation', async () => {
    const app = createApplication({ modules: [deterministicKernel(), orderingModule] });
    const replacement = new InMemoryCommandBus();

    overrideForTests(app, COMMAND_BUS, replacement);

    await expect(replacement.execute(new PlaceOrder('book'))).resolves.toBe('order-1');
  });

  it('rejects a command handled twice, naming both modules', () => {
    const duplicate = defineContextModule({
      name: 'archive',
      register: (builder) => builder.command(CancelOrder).handledBy(CancelOrderHandler, [ORDER_REPOSITORY]),
    });

    const error = wiringFailure(() =>
      createApplication({ modules: [kernelModule(), orderingModule, duplicate] }),
    );

    expect(error.code).toBe('DUPLICATE_HANDLER');
    expect(error.message).toContain('"CancelOrder"');
    expect(error.message).toContain('"ordering"');
    expect(error.message).toContain('"archive"');
  });

  it('rejects a handler dependency that no module binds, before any message', () => {
    const error = wiringFailure(() => createApplication({ modules: [orderingModule] }));

    expect(error.code).toBe('UNBOUND_DEPENDENCY');
    expect(error.message).toContain('"PlaceOrderHandler"');
  });

  it('asks for the kernel module when handlers have no bus to go on', () => {
    const lonely = defineContextModule({
      name: 'lonely',
      register(builder) {
        builder.bind(ORDER_REPOSITORY).toClass(InMemoryOrderRepository);
        builder.query(GetOrder).handledBy(GetOrderHandler, [ORDER_REPOSITORY]);
      },
    });

    const error = wiringFailure(() => createApplication({ modules: [lonely] }));

    expect(error.code).toBe('UNBOUND_DEPENDENCY');
    expect(error.message).toContain('the query "GetOrder"');
    expect(error.message).toContain('kernelModule()');
  });

  it('rejects a bus that cannot receive handlers', () => {
    const remote: CommandBus = { execute: () => Promise.reject(new Error('remote transport')) };

    const error = wiringFailure(() =>
      createApplication({
        modules: [deterministicKernel(), orderingModule],
        overrides: [override(COMMAND_BUS, remote)],
      }),
    );

    expect(error.code).toBe('BUS_WITHOUT_REGISTER');
    expect(error.message).toContain('"kernel.CommandBus"');
  });

  it('rejects a command left without a handler', () => {
    const sloppy = defineContextModule({
      name: 'sloppy',
      register: (builder) => void builder.command(PlaceOrder),
    });

    const error = wiringFailure(() => createApplication({ modules: [kernelModule(), sloppy] }));

    expect(error.code).toBe('INCOMPLETE_BINDING');
    expect(error.message).toContain('command(PlaceOrder) without handledBy or handledByFactory');
  });
});

describe('typing of the use case declarations', () => {
  it('rejects, at compile time, a wrong handler and misordered dependencies', () => {
    const module = defineContextModule({
      name: 'typed',
      register(builder) {
        // @ts-expect-error CancelOrderHandler does not handle PlaceOrder
        builder.command(PlaceOrder).handledBy(CancelOrderHandler, [ORDER_REPOSITORY]);
        // @ts-expect-error a query handler answering another result type is not its handler
        builder.query(GetOrder).handledByFactory(() => ({ execute: async () => 42 }));
        builder
          .command(PlaceOrder)
          // @ts-expect-error the tokens must follow the order of the constructor parameters
          .handledBy(PlaceOrderHandler, [ORDER_REPOSITORY, EVENT_PUBLISHER, CLOCK, ID_GENERATOR]);
        // @ts-expect-error a constructor with parameters needs its tokens
        builder.query(GetOrder).handledBy(GetOrderHandler);
      },
    });

    expect(module.name).toBe('typed');
  });
});
