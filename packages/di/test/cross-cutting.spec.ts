import { describe, expect, it } from 'vitest';
import {
  ActorContext,
  Cache,
  CacheInvalidation,
  CachePurgeRequest,
  InMemoryEventBus,
  ExecutionScope,
  FixedClock,
  FixedExecutionScope,
  InMemoryCache,
  InMemoryLock,
  InMemoryLogger,
  InMemoryMetrics,
  InMemoryRateLimiter,
  Lock,
  Logger,
  Metrics,
  NoopLogger,
  NoopMetrics,
  RateLimiter,
  ScopedActorContext,
  cacheKey,
  cacheTag,
  executionContext,
  type Actor,
} from '@ddd-ts-kit/kernel';
import {
  createApplication,
  createTestApplication,
  defineContextModule,
  kernelModule,
  type BindingAspect,
  type BindingAspectInfo,
} from '../src';

const ada: Actor = { id: 'ada', type: 'user', tenantId: 'acme', roles: [], attributes: {} };
const bob: Actor = { id: 'bob', type: 'user', roles: [], attributes: {} };

describe('kernelModule', () => {
  it('binds the cross-cutting ports to defaults that do nothing or stay in memory', async () => {
    const app = createApplication({ modules: [kernelModule()] });

    expect(app.resolve(Logger)).toBeInstanceOf(NoopLogger);
    expect(app.resolve(Metrics)).toBeInstanceOf(NoopMetrics);
    expect(app.resolve(Cache)).toBeInstanceOf(InMemoryCache);
    await app.resolve(Cache).set(cacheKey<number>('answer'), 42, { ttlMs: 60_000 });
    expect(await app.resolve(Cache).get(cacheKey<number>('answer'))).toBe(42);
  });

  it('binds the lock and the rate limiter to their in-memory implementations, replaced through its options', async () => {
    const app = createApplication({ modules: [kernelModule()] });
    const lock = new InMemoryLock(new FixedClock(new Date(0)));

    expect(app.resolve(Lock)).toBeInstanceOf(InMemoryLock);
    expect(app.resolve(RateLimiter)).toBeInstanceOf(InMemoryRateLimiter);
    expect((await app.resolve(Lock).acquire('report', { ttlMs: 1_000 }))?.fencingToken).toBe(1);

    expect(await app.resolve(RateLimiter).consume('client-a', { limit: 1, windowMs: 1_000 })).toMatchObject({
      allowed: true,
    });

    expect(createApplication({ modules: [kernelModule({ lock })] }).resolve(Lock)).toBe(lock);
  });

  it('takes the adapters of the platform through its options', () => {
    const logger = new InMemoryLogger();
    const metrics = new InMemoryMetrics();
    const executionScope = new FixedExecutionScope();

    const app = createApplication({ modules: [kernelModule({ logger, metrics, executionScope })] });

    expect(app.resolve(Logger)).toBe(logger);
    expect(app.resolve(Metrics)).toBe(metrics);
    expect(app.resolve(ExecutionScope)).toBe(executionScope);
  });

  it('makes the actor context read the execution scope: the two cannot disagree', () => {
    const app = createApplication({ modules: [kernelModule()] });
    const scope = app.resolve(ExecutionScope);
    const actors = app.resolve(ActorContext);
    const request = executionContext({ correlationId: 'corr-1', actor: ada, origin: 'http' });

    expect(actors).toBeInstanceOf(ScopedActorContext);
    expect(scope.run(request, () => actors.require())).toBe(ada);
    expect(actors.run(bob, () => scope.require())).toMatchObject({ actor: bob, origin: 'internal' });
    expect(scope.run(request, () => actors.run(bob, () => scope.require().correlationId))).toBe('corr-1');
    expect(actors.current()).toBeUndefined();
  });
});

describe('kernelModule and the HTTP caches', () => {
  it('binds the invalidation of cache tags to purge requests on the publisher of the application, the tags as they are', async () => {
    const bus = new InMemoryEventBus();
    const app = createApplication({ modules: [kernelModule({ eventPublisher: bus })] });
    const request = executionContext({ correlationId: 'corr-1', actor: ada, origin: 'http' });

    await app
      .resolve(ExecutionScope)
      .run(request, () => app.resolve(CacheInvalidation).invalidate([cacheTag('order', 7)]));

    expect(bus.published.map((event) => CachePurgeRequest.tagsOf(event))).toEqual([['order:7']]);
  });
});

describe('createTestApplication', () => {
  it('exposes the in-memory fakes of the cross-cutting ports', async () => {
    const app = createTestApplication({ modules: [] });

    app.get(Logger).info('order shipped', { context: 'shipping' });
    app.get(Metrics).counter('orders_total').increment();
    await app.get(Cache).set(cacheKey<string>('greeting'), 'hello', { ttlMs: 1000 });
    app.clock.advance(1000);

    expect(app.logger.entries).toEqual([{ level: 'info', message: 'order shipped', fields: { context: 'shipping' } }]);
    expect(app.metrics.counterValue('orders_total')).toBe(1);
    expect(await app.cache.get(cacheKey<string>('greeting'))).toBeUndefined();
  });

  it('remembers the tags the use cases asked to purge after their commit', async () => {
    const app = createTestApplication({ modules: [] });

    await app.get(CacheInvalidation).invalidate([cacheTag('order', 7)]);

    expect(app.cacheInvalidation.invalidated).toEqual(['order:7']);
  });

  it('exposes the lock and the rate limiter, which read the clock of the test', async () => {
    const app = createTestApplication({ modules: [] });
    const once = { limit: 1, windowMs: 1_000 };

    await app.get(Lock).acquire('report', { ttlMs: 1_000 });
    await app.get(RateLimiter).consume('client-a', once);
    expect(await app.lock.acquire('report', { ttlMs: 1_000 })).toBeUndefined();
    expect((await app.rateLimiter.consume('client-a', once)).allowed).toBe(false);
    app.clock.advance(1_000);

    expect((await app.lock.acquire('report', { ttlMs: 1_000 }))?.fencingToken).toBe(2);
    expect((await app.rateLimiter.consume('client-a', once)).allowed).toBe(true);
  });

  it('gives infrastructure an execution context that follows the current actor', () => {
    const app = createTestApplication({ modules: [], actor: ada });

    expect(app.get(ExecutionScope)).toBe(app.executionScope);

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

abstract class Greeter {
  abstract greet(name: string): Promise<string>;
}

class PoliteGreeter implements Greeter {
  async greet(name: string): Promise<string> {
    return `hello ${name}`;
  }
}

/** A string is all this asks for: the one value a module can bind that is not an object. */
abstract class Motto {
  abstract readonly length: number;
}

/** A binding aspect made by hand: it replaces `greet` on the instance it is given. */
function marking(mark: string, seen: BindingAspectInfo[] = []): BindingAspect {
  return (instance, info) => {
    seen.push(info);

    const greet: unknown = Reflect.get(instance, 'greet');

    if (typeof greet !== 'function') {
      return instance;
    }

    Reflect.set(
      instance,
      'greet',
      async (name: string) => `${mark}(${String(await Reflect.apply(greet, instance, [name]))})`,
    );

    return instance;
  };
}

describe('binding.with(...aspects)', () => {
  it('wraps every instance of the binding, the first aspect outermost', async () => {
    const greeting = defineContextModule({
      name: 'greeting',
      register(builder) {
        builder.bind(Greeter).toClass(PoliteGreeter).as('gateway').with(marking('outer'), marking('inner')).transient();
      },
    });

    const app = createApplication({ modules: [greeting] });

    expect(await app.resolve(Greeter).greet('ada')).toBe('outer(inner(hello ada))');
    expect(await app.resolve(Greeter).greet('bob')).toBe('outer(inner(hello bob))');
    expect(app.resolve(Greeter)).toBeInstanceOf(PoliteGreeter);
  });

  it('tells the aspect the class, the kind, the module and the port', () => {
    const seen: BindingAspectInfo[] = [];

    const greeting = defineContextModule({
      name: 'greeting',
      register(builder) {
        builder
          .bind(Greeter)
          .toFactory(() => new PoliteGreeter())
          .with(marking('m', seen))
          .as('external');
      },
    });

    createApplication({ modules: [greeting] }).resolve(Greeter);

    expect(seen).toEqual([{ className: 'PoliteGreeter', context: 'greeting', token: 'Greeter', kind: 'external' }]);
  });

  it('puts the decorate hook of the application around the aspects of the binding', async () => {
    const greeting = defineContextModule({
      name: 'greeting',
      register(builder) {
        builder.bind(Greeter).toClass(PoliteGreeter).with(marking('binding'));
      },
    });

    const app = createApplication({
      modules: [greeting],
      decorate: (instance) =>
        instance instanceof PoliteGreeter
          ? marking('application')(instance, { className: '', context: '', token: '' })
          : instance,
    });

    expect(await app.resolve(Greeter).greet('ada')).toBe('application(binding(hello ada))');
  });

  it('leaves a value that is not an object alone', () => {
    const greeting = defineContextModule({
      name: 'greeting',
      register(builder) {
        builder.bind(Motto).toValue('be kind').with(marking('never'));
      },
    });

    expect(createApplication({ modules: [greeting] }).resolve(Motto)).toBe('be kind');
  });
});
