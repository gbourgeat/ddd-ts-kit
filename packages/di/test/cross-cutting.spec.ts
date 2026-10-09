import { describe, expect, it } from 'vitest';
import {
  FixedExecutionScope,
  InMemoryCache,
  InMemoryLogger,
  InMemoryMetrics,
  NoopLogger,
  NoopMetrics,
  ScopedActorContext,
  cacheKey,
  executionContext,
  type Actor,
} from '@ddd-ts-kit/kernel';
import {
  ACTOR_CONTEXT,
  CACHE,
  EXECUTION_SCOPE,
  LOGGER,
  METRICS,
  createApplication,
  createTestApplication,
  defineContextModule,
  kernelModule,
  token,
  type BindingAspect,
  type BindingAspectInfo,
} from '../src/index.js';

const ada: Actor = { id: 'ada', type: 'user', tenantId: 'acme', roles: [], attributes: {} };
const bob: Actor = { id: 'bob', type: 'user', roles: [], attributes: {} };

describe('kernelModule', () => {
  it('binds the cross-cutting ports to defaults that do nothing or stay in memory', async () => {
    const app = createApplication({ modules: [kernelModule()] });

    expect(app.resolve(LOGGER)).toBeInstanceOf(NoopLogger);
    expect(app.resolve(METRICS)).toBeInstanceOf(NoopMetrics);
    expect(app.resolve(CACHE)).toBeInstanceOf(InMemoryCache);
    await app.resolve(CACHE).set(cacheKey<number>('answer'), 42, { ttlMs: 60_000 });
    expect(await app.resolve(CACHE).get(cacheKey<number>('answer'))).toBe(42);
  });

  it('takes the adapters of the platform through its options', () => {
    const logger = new InMemoryLogger();
    const metrics = new InMemoryMetrics();
    const executionScope = new FixedExecutionScope();

    const app = createApplication({ modules: [kernelModule({ logger, metrics, executionScope })] });

    expect(app.resolve(LOGGER)).toBe(logger);
    expect(app.resolve(METRICS)).toBe(metrics);
    expect(app.resolve(EXECUTION_SCOPE)).toBe(executionScope);
  });

  it('makes the actor context read the execution scope: the two cannot disagree', () => {
    const app = createApplication({ modules: [kernelModule()] });
    const scope = app.resolve(EXECUTION_SCOPE);
    const actors = app.resolve(ACTOR_CONTEXT);
    const request = executionContext({ correlationId: 'corr-1', actor: ada, origin: 'http' });

    expect(actors).toBeInstanceOf(ScopedActorContext);
    expect(scope.run(request, () => actors.require())).toBe(ada);
    expect(actors.run(bob, () => scope.require())).toMatchObject({ actor: bob, origin: 'internal' });
    expect(scope.run(request, () => actors.run(bob, () => scope.require().correlationId))).toBe('corr-1');
    expect(actors.current()).toBeUndefined();
  });
});

describe('createTestApplication', () => {
  it('exposes the in-memory fakes of the cross-cutting ports', async () => {
    const app = createTestApplication({ modules: [] });

    app.get(LOGGER).info('order shipped', { context: 'shipping' });
    app.get(METRICS).counter('orders_total').increment();
    await app.get(CACHE).set(cacheKey<string>('greeting'), 'hello', { ttlMs: 1000 });
    app.clock.advance(1000);

    expect(app.logger.entries).toEqual([{ level: 'info', message: 'order shipped', fields: { context: 'shipping' } }]);
    expect(app.metrics.counterValue('orders_total')).toBe(1);
    expect(await app.cache.get(cacheKey<string>('greeting'))).toBeUndefined();
  });

  it('gives infrastructure an execution context that follows the current actor', () => {
    const app = createTestApplication({ modules: [], actor: ada });

    expect(app.get(EXECUTION_SCOPE)).toBe(app.executionScope);
    expect(app.executionScope.require()).toMatchObject({
      correlationId: 'test-correlation',
      origin: 'test',
      actor: ada,
      tenantId: 'acme',
    });
    app.actorContext.actAs(bob);
    expect(app.executionScope.require().actor).toBe(bob);
    app.executionScope.enter(executionContext({ correlationId: 'corr-9', actor: ada, origin: 'event' }));
    expect(app.actorContext.require()).toBe(ada);
  });
});

class Greeter {
  async greet(name: string): Promise<string> {
    return `hello ${name}`;
  }
}

const GREETER = token<Greeter>('greeting.Greeter');
const MOTTO = token<string>('greeting.Motto');

/** A binding aspect made by hand: it replaces `greet` on the instance it is given. */
function marking(mark: string, seen: BindingAspectInfo[] = []): BindingAspect {
  return (instance, info) => {
    seen.push(info);
    const greet: unknown = Reflect.get(instance, 'greet');
    if (typeof greet !== 'function') return instance;
    Reflect.set(instance, 'greet', async (name: string) => `${mark}(${String(await Reflect.apply(greet, instance, [name]))})`);
    return instance;
  };
}

describe('binding.with(...aspects)', () => {
  it('wraps every instance of the binding, the first aspect outermost', async () => {
    const greeting = defineContextModule({
      name: 'greeting',
      register(builder) {
        builder.bind(GREETER).toClass(Greeter).as('gateway').with(marking('outer'), marking('inner')).transient();
      },
    });
    const app = createApplication({ modules: [greeting] });

    expect(await app.resolve(GREETER).greet('ada')).toBe('outer(inner(hello ada))');
    expect(await app.resolve(GREETER).greet('bob')).toBe('outer(inner(hello bob))');
    expect(app.resolve(GREETER)).toBeInstanceOf(Greeter);
  });

  it('tells the aspect the class, the kind, the module and the token', () => {
    const seen: BindingAspectInfo[] = [];
    const greeting = defineContextModule({
      name: 'greeting',
      register(builder) {
        builder.bind(GREETER).toFactory(() => new Greeter()).with(marking('m', seen)).as('external');
      },
    });

    createApplication({ modules: [greeting] }).resolve(GREETER);

    expect(seen).toEqual([{ className: 'Greeter', context: 'greeting', token: 'greeting.Greeter', kind: 'external' }]);
  });

  it('puts the decorate hook of the application around the aspects of the binding', async () => {
    const greeting = defineContextModule({
      name: 'greeting',
      register(builder) {
        builder.bind(GREETER).toClass(Greeter).with(marking('binding'));
      },
    });
    const app = createApplication({
      modules: [greeting],
      decorate: (instance) => (instance instanceof Greeter ? marking('application')(instance, { className: '', context: '', token: '' }) : instance),
    });

    expect(await app.resolve(GREETER).greet('ada')).toBe('application(binding(hello ada))');
  });

  it('leaves a value that is not an object alone', () => {
    const greeting = defineContextModule({
      name: 'greeting',
      register(builder) {
        builder.bind(MOTTO).toValue('be kind').with(marking('never'));
      },
    });

    expect(createApplication({ modules: [greeting] }).resolve(MOTTO)).toBe('be kind');
  });
});
