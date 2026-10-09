import { describe, expect, it } from 'vitest';
import {
  WiringError,
  createApplication,
  defineContextModule,
  override,
  overrideForTests,
  token,
  type BindingInfo,
  type ContextModule,
} from '../src/index.js';

interface Clock {
  now(): Date;
}

interface OrderRepository {
  save(id: string): Promise<void>;
  saved(): readonly string[];
}

class FixedClock implements Clock {
  now(): Date {
    return new Date(0);
  }
}

class InMemoryOrderRepository implements OrderRepository {
  readonly #ids: string[] = [];

  async save(id: string): Promise<void> {
    this.#ids.push(id);
  }

  saved(): readonly string[] {
    return this.#ids;
  }
}

// No decorator anywhere: the class only knows its ports.
class PlaceOrderHandler {
  constructor(
    readonly orders: OrderRepository,
    readonly clock: Clock,
  ) {}

  async execute(id: string): Promise<string> {
    await this.orders.save(id);
    return `${id}@${this.clock.now().getTime()}`;
  }
}

const CLOCK = token<Clock>('Clock');
const ORDER_REPOSITORY = token<OrderRepository>('OrderRepository');
const PLACE_ORDER = token<PlaceOrderHandler>('PlaceOrderHandler');

const platform = defineContextModule({
  name: 'platform',
  register(builder) {
    builder.bind(CLOCK).toClass(FixedClock);
  },
});

const ordering = defineContextModule({
  name: 'ordering',
  register(builder) {
    builder.bind(ORDER_REPOSITORY).toClass(InMemoryOrderRepository).as('repository');
    builder.bind(PLACE_ORDER).toClass(PlaceOrderHandler, [ORDER_REPOSITORY, CLOCK]).as('use-case');
  },
});

async function failure(run: () => unknown): Promise<WiringError> {
  try {
    await run();
  } catch (error) {
    if (error instanceof WiringError) return error;
    throw error;
  }
  throw new Error('expected a WiringError');
}

describe('token', () => {
  it('creates distinct tokens even for the same description', () => {
    expect(token<Clock>('Clock')).not.toBe(token<Clock>('Clock'));
    expect(CLOCK.description).toBe('Clock');
  });
});

describe('createApplication', () => {
  it('resolves a class with its constructor arguments taken from the listed tokens, in order', async () => {
    const app = createApplication({ modules: [platform, ordering] });

    const handler = app.resolve(PLACE_ORDER);

    expect(handler).toBeInstanceOf(PlaceOrderHandler);
    expect(handler.orders).toBe(app.resolve(ORDER_REPOSITORY));
    await expect(handler.execute('order-1')).resolves.toBe('order-1@0');
    expect(app.resolve(ORDER_REPOSITORY).saved()).toEqual(['order-1']);
  });

  it('does not depend on the order of the modules', () => {
    const app = createApplication({ modules: [ordering, platform] });

    expect(app.resolve(PLACE_ORDER).clock).toBeInstanceOf(FixedClock);
  });

  it('shares a singleton by default and builds a transient on every resolution', () => {
    const TRANSIENT = token<InMemoryOrderRepository>('Transient');
    const app = createApplication({
      modules: [
        ordering,
        platform,
        defineContextModule({
          name: 'extra',
          register: (builder) => {
            builder.bind(TRANSIENT).toClass(InMemoryOrderRepository).transient();
          },
        }),
      ],
    });

    expect(app.resolve(ORDER_REPOSITORY)).toBe(app.resolve(ORDER_REPOSITORY));
    expect(app.resolve(TRANSIENT)).not.toBe(app.resolve(TRANSIENT));
  });

  it('binds factories and values', () => {
    const GREETING = token<string>('Greeting');
    const BANNER = token<{ text: string }>('Banner');
    let built = 0;
    const app = createApplication({
      modules: [
        defineContextModule({
          name: 'ui',
          register(builder) {
            builder.bind(GREETING).toValue('hello');
            builder.bind(BANNER).toFactory((resolve) => {
              built += 1;
              return { text: `${resolve(GREETING)}!` };
            });
          },
        }),
      ],
    });

    expect(app.resolve(BANNER)).toEqual({ text: 'hello!' });
    expect(app.resolve(BANNER)).toBe(app.resolve(BANNER));
    expect(built).toBe(1);
  });

  it('builds a transient factory every time', () => {
    const COUNTER = token<number>('Counter');
    let next = 0;
    const app = createApplication({
      modules: [
        defineContextModule({
          name: 'counter',
          register: (builder) => {
            builder.bind(COUNTER).toFactory(() => (next += 1)).transient();
          },
        }),
      ],
    });

    expect([app.resolve(COUNTER), app.resolve(COUNTER)]).toEqual([1, 2]);
  });

  it('isolates two applications built from the same modules', () => {
    const first = createApplication({ modules: [platform, ordering] });
    const second = createApplication({ modules: [platform, ordering] });

    expect(first.resolve(ORDER_REPOSITORY)).not.toBe(second.resolve(ORDER_REPOSITORY));
    expect(first.container).not.toBe(second.container);
  });

  it('exposes the tsyringe container holding the bindings', () => {
    const app = createApplication({ modules: [platform] });

    expect(app.container.isRegistered(CLOCK)).toBe(true);
    expect(app.container.resolve<Clock>(CLOCK)).toBe(app.resolve(CLOCK));
  });
});

describe('decorate hook', () => {
  it('receives every created instance once, with token, context and declared kind', () => {
    const seen: BindingInfo[] = [];
    const app = createApplication({
      modules: [platform, ordering],
      decorate: (instance, info) => {
        seen.push(info);
        return instance;
      },
    });

    app.resolve(PLACE_ORDER);
    app.resolve(PLACE_ORDER);

    expect(seen).toEqual([
      { token: ORDER_REPOSITORY, context: 'ordering', kind: 'repository' },
      { token: CLOCK, context: 'platform' },
      { token: PLACE_ORDER, context: 'ordering', kind: 'use-case' },
    ]);
  });

  it('hands out what the hook returns, to resolvers and to dependents alike', () => {
    const stamped = new WeakSet<object>();
    const app = createApplication({
      modules: [platform, ordering],
      decorate: (instance, info) => {
        if (info.kind === 'repository' && typeof instance === 'object' && instance !== null) {
          stamped.add(instance);
        }
        return instance;
      },
    });

    expect(stamped.has(app.resolve(PLACE_ORDER).orders)).toBe(true);
    expect(stamped.has(app.resolve(PLACE_ORDER))).toBe(false);
  });

  it('runs for each instance of a transient binding and for values', () => {
    const VALUE = token<{ id: number }>('Value');
    const TRANSIENT = token<FixedClock>('TransientClock');
    let calls = 0;
    const app = createApplication({
      modules: [
        defineContextModule({
          name: 'misc',
          register(builder) {
            builder.bind(VALUE).toValue({ id: 1 }).as('external');
            builder.bind(TRANSIENT).toClass(FixedClock).transient();
          },
        }),
      ],
      decorate: (instance) => {
        calls += 1;
        return instance;
      },
    });

    app.resolve(VALUE);
    app.resolve(VALUE);
    app.resolve(TRANSIENT);
    app.resolve(TRANSIENT);

    expect(calls).toBe(3);
  });
});

describe('lifecycle', () => {
  const recording = (name: string, log: string[]): ContextModule =>
    defineContextModule({
      name,
      register: () => {},
      onStart: async () => void log.push(`start ${name}`),
      onStop: async () => void log.push(`stop ${name}`),
    });

  it('starts modules in order and stops them in reverse order', async () => {
    const log: string[] = [];
    const app = createApplication({ modules: [recording('a', log), recording('b', log), platform] });

    await app.start();
    await app.stop();

    expect(log).toEqual(['start a', 'start b', 'stop b', 'stop a']);
  });

  it('gives the hooks a resolver', async () => {
    let now: Date | undefined;
    const app = createApplication({
      modules: [
        platform,
        defineContextModule({
          name: 'jobs',
          register: () => {},
          onStart: ({ resolve }) => {
            now = resolve(CLOCK).now();
          },
        }),
      ],
    });

    await app.start();

    expect(now).toEqual(new Date(0));
  });

  it('stops only what was started, once, and keeps stopping after a failure', async () => {
    const log: string[] = [];
    const failing = defineContextModule({
      name: 'failing',
      register: () => {},
      onStop: () => {
        throw new Error('cannot close');
      },
    });
    const app = createApplication({ modules: [recording('a', log), failing] });

    await app.stop();
    expect(log).toEqual([]);

    await app.start();
    await app.start();
    await expect(app.stop()).rejects.toThrow(AggregateError);
    await app.stop();

    expect(log).toEqual(['start a', 'stop a']);
  });
});

describe('wiring errors', () => {
  it('rejects a token bound twice and names both modules', async () => {
    const duplicate = defineContextModule({
      name: 'billing',
      register: (builder) => {
        builder.bind(CLOCK).toValue(new FixedClock());
      },
    });

    const error = await failure(() => createApplication({ modules: [platform, duplicate] }));

    expect(error.code).toBe('DUPLICATE_BINDING');
    expect(error.message).toContain('"Clock"');
    expect(error.message).toContain('"platform"');
    expect(error.message).toContain('"billing"');
  });

  it('rejects a dependency that no module binds, naming the token and the module', async () => {
    const error = await failure(() => createApplication({ modules: [ordering] }));

    expect(error.code).toBe('UNBOUND_DEPENDENCY');
    expect(error.message).toContain('"Clock"');
    expect(error.message).toContain('"PlaceOrderHandler"');
    expect(error.message).toContain('"ordering"');
  });

  it('rejects a cycle between class bindings before instantiating anything', async () => {
    class Node {
      static built = 0;
      constructor(readonly next: Node) {
        Node.built += 1;
      }
    }
    const A = token<Node>('A');
    const B = token<Node>('B');
    const C = token<Node>('C');
    const cyclic = defineContextModule({
      name: 'cyclic',
      register(builder) {
        builder.bind(A).toClass(Node, [B]);
        builder.bind(B).toClass(Node, [C]);
        builder.bind(C).toClass(Node, [A]);
      },
    });

    const error = await failure(() => createApplication({ modules: [cyclic] }));

    expect(error.code).toBe('DEPENDENCY_CYCLE');
    expect(error.message).toContain('"A" -> "B" -> "C" -> "A"');
    expect(Node.built).toBe(0);
  });

  it('rejects a cycle going through factories when it is resolved', async () => {
    const A = token<unknown>('A');
    const B = token<unknown>('B');
    const app = createApplication({
      modules: [
        defineContextModule({
          name: 'cyclic',
          register(builder) {
            builder.bind(A).toFactory((resolve) => resolve(B));
            builder.bind(B).toFactory((resolve) => resolve(A));
          },
        }),
      ],
    });

    const error = await failure(() => app.resolve(A));

    expect(error.code).toBe('DEPENDENCY_CYCLE');
    expect(error.message).toContain('"A" -> "B" -> "A"');
  });

  it('rejects the resolution of an unbound token, naming who asked', async () => {
    const MISSING = token<string>('Missing');
    const NEEDY = token<string>('Needy');
    const app = createApplication({
      modules: [
        defineContextModule({
          name: 'needy',
          register: (builder) => {
            builder.bind(NEEDY).toFactory((resolve) => resolve(MISSING));
          },
        }),
      ],
    });

    expect((await failure(() => app.resolve(MISSING))).code).toBe('UNBOUND_TOKEN');
    expect((await failure(() => app.resolve(NEEDY))).message).toContain('required by "Needy"');
  });

  it('rejects a bind left without a target', async () => {
    const error = await failure(() =>
      createApplication({
        modules: [defineContextModule({ name: 'sloppy', register: (builder) => void builder.bind(CLOCK) })],
      }),
    );

    expect(error.code).toBe('INCOMPLETE_BINDING');
    expect(error.message).toContain('"sloppy"');
  });
});

describe('overrides for tests', () => {
  class FakeClock implements Clock {
    now(): Date {
      return new Date(1000);
    }
  }

  it('swaps a binding through the overrides option, without decorating the fake', async () => {
    const decorated: string[] = [];
    const app = createApplication({
      modules: [platform, ordering],
      overrides: [override(CLOCK, new FakeClock())],
      decorate: (instance, info) => {
        decorated.push(info.token.description ?? '');
        return instance;
      },
    });

    await expect(app.resolve(PLACE_ORDER).execute('o')).resolves.toBe('o@1000');
    expect(decorated).not.toContain('Clock');
  });

  it('lets an override stand in for a module that is not loaded', () => {
    const app = createApplication({
      modules: [ordering],
      overrides: [override(CLOCK, new FakeClock())],
    });

    expect(app.resolve(PLACE_ORDER).clock).toBeInstanceOf(FakeClock);
  });

  it('swaps a binding on an existing application', () => {
    const app = createApplication({ modules: [platform, ordering] });
    const fake = new FakeClock();

    overrideForTests(app, CLOCK, fake);

    expect(app.resolve(CLOCK)).toBe(fake);
    expect(app.resolve(PLACE_ORDER).clock).toBe(fake);
  });
});

describe('typing', () => {
  it('rejects, at compile time, tokens that do not match the constructor', () => {
    const NUMBER = token<number>('Number');
    defineContextModule({
      name: 'typed',
      register(builder) {
        // @ts-expect-error the second argument must be a Token<Clock>
        builder.bind(PLACE_ORDER).toClass(PlaceOrderHandler, [ORDER_REPOSITORY, NUMBER]);
        // @ts-expect-error a constructor with parameters needs its tokens
        builder.bind(PLACE_ORDER).toClass(PlaceOrderHandler);
        // @ts-expect-error the class must implement the token's type
        builder.bind(CLOCK).toClass(InMemoryOrderRepository);
        // @ts-expect-error the value must match the token's type
        builder.bind(CLOCK).toValue('noon');
        // @ts-expect-error an override must match the token's type
        override(CLOCK, 12);
      },
    });
    const resolved: Clock = createApplication({ modules: [platform] }).resolve(CLOCK);
    expect(resolved.now()).toEqual(new Date(0));
  });
});
