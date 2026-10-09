import { SpanStatusCode, trace } from '@opentelemetry/api';
import { DomainError } from '@ddd-ts-kit/kernel';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DROPPED_SPANS_ATTRIBUTE,
  LocalRootTracker,
  configureTracing,
  resetTracingConfiguration,
  traceDependency,
  traceUseCase,
  withSpan,
} from '../src/index.js';
import { setupTracing, type TestTracing } from './support.js';

class InsufficientFunds extends DomainError {
  readonly code = 'INSUFFICIENT_FUNDS';
}

class AccountRepository {
  readonly #rows = new Map<string, number>([['acc-1', 100]]);
  initialised = false;

  get size(): number {
    return this.#rows.size;
  }

  async findBalance(id: string): Promise<number | undefined> {
    return this.#read(id);
  }

  async debit(id: string, amount: number): Promise<void> {
    if ((this.#read(id) ?? 0) < amount) throw new InsufficientFunds(`account ${id} lacks ${amount}`);
  }

  async crash(): Promise<void> {
    throw new TypeError('connection to db.internal:5432 refused for user admin');
  }

  async rejectWithDriverCode(): Promise<void> {
    throw Object.assign(new Error('boom'), { code: 'ECONNREFUSED' });
  }

  async rejectWithUnsafeCode(): Promise<void> {
    throw Object.assign(new Error('boom'), { code: 'not an identifier' });
  }

  tableName(): string {
    return 'accounts';
  }

  // Not declared async: only its return value reveals that it is.
  lazyCount(): Promise<number> {
    return Promise.resolve(this.#rows.size);
  }

  *ids(): Generator<string> {
    yield* this.#rows.keys();
  }

  async *stream(): AsyncGenerator<string> {
    yield* this.#rows.keys();
  }

  async onModuleInit(): Promise<void> {
    this.initialised = true;
  }

  async warmUp(): Promise<void> {}

  async [Symbol.asyncDispose](): Promise<void> {}

  #read(id: string): number | undefined {
    return this.#rows.get(id);
  }
}

describe('traceDependency', () => {
  let tracing: TestTracing;

  beforeEach(() => {
    tracing = setupTracing([new LocalRootTracker()]);
  });

  afterEach(() => {
    tracing.teardown();
    resetTracingConfiguration();
  });

  const repository = (): AccountRepository =>
    traceDependency(new AccountRepository(), { kind: 'repository', context: 'billing' });

  it('names the span after kind, class and method and describes the dependency', async () => {
    await repository().findBalance('acc-1');

    const span = tracing.span('repository.AccountRepository.findBalance');
    expect(span.attributes).toEqual({
      'code.namespace': 'AccountRepository',
      'code.function': 'findBalance',
      'app.context': 'billing',
      'app.dependency.kind': 'repository',
    });
  });

  it('returns the same instance, still an instance of its class, with private members working', async () => {
    const original = new AccountRepository();
    const wrapped = traceDependency(original, { kind: 'repository' });

    expect(wrapped).toBe(original);
    expect(wrapped).toBeInstanceOf(AccountRepository);
    await expect(wrapped.findBalance('acc-1')).resolves.toBe(100);
  });

  it('is idempotent: wrapping twice still yields one span per call', async () => {
    const twice = traceDependency(repository(), { kind: 'gateway', className: 'Other' });

    await twice.findBalance('acc-1');

    expect(tracing.spans().map((span) => span.name)).toEqual([
      'repository.AccountRepository.findBalance',
    ]);
  });

  it('uses the given class name when the constructor name cannot be trusted', async () => {
    const wrapped = traceDependency(new AccountRepository(), {
      kind: 'gateway',
      className: 'Accounts',
    });

    await wrapped.findBalance('acc-1');

    expect(tracing.span('gateway.Accounts.findBalance').attributes['code.namespace']).toBe('Accounts');
  });

  it('produces no span for a synchronous method', () => {
    expect(repository().tableName()).toBe('accounts');
    expect(tracing.spans()).toHaveLength(0);
  });

  it('traces a method not declared async once it has returned a thenable', async () => {
    const wrapped = repository();

    await wrapped.lazyCount();
    expect(tracing.spans()).toHaveLength(0);

    await expect(wrapped.lazyCount()).resolves.toBe(1);
    expect(tracing.spans().map((span) => span.name)).toEqual([
      'repository.AccountRepository.lazyCount',
    ]);
  });

  it('never records arguments, return values or the error message', async () => {
    const wrapped = repository();

    await wrapped.findBalance('acc-1');
    await expect(wrapped.debit('acc-1', 5000)).rejects.toThrow();

    const recorded = JSON.stringify(
      tracing.spans().map((span) => [span.attributes, span.events, span.status]),
    );
    expect(recorded).not.toContain('acc-1');
    expect(recorded).not.toContain('5000');
    expect(recorded).not.toContain('100');
    expect(recorded).not.toContain('lacks');
  });

  it('reports a domain error by class name and code, and rethrows it untouched', async () => {
    const failure = await repository()
      .debit('acc-1', 5000)
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(InsufficientFunds);
    const span = tracing.span('repository.AccountRepository.debit');
    expect(span.status).toEqual({ code: SpanStatusCode.ERROR });
    expect(span.attributes['error.type']).toBe('InsufficientFunds');
    expect(span.attributes['app.error.code']).toBe('INSUFFICIENT_FUNDS');
    expect(span.events).toHaveLength(0);
  });

  it('reports an infrastructure fault by class name only', async () => {
    await expect(repository().crash()).rejects.toThrow(TypeError);

    const span = tracing.span('repository.AccountRepository.crash');
    expect(span.attributes['error.type']).toBe('TypeError');
    expect(span.attributes).not.toHaveProperty('app.error.code');
  });

  it('keeps an identifier-shaped code of any error and drops any other code', async () => {
    const wrapped = repository();
    await expect(wrapped.rejectWithDriverCode()).rejects.toThrow();
    await expect(wrapped.rejectWithUnsafeCode()).rejects.toThrow();

    expect(
      tracing.span('repository.AccountRepository.rejectWithDriverCode').attributes['app.error.code'],
    ).toBe('ECONNREFUSED');
    expect(
      tracing.span('repository.AccountRepository.rejectWithUnsafeCode').attributes,
    ).not.toHaveProperty('app.error.code');
  });

  it('omits error.type when the class name is not identifier-shaped', async () => {
    const Weird = { 'not valid': class extends Error {} }['not valid'];
    const gateway = traceDependency(
      {
        async call(): Promise<void> {
          throw new Weird('secret');
        },
      },
      { kind: 'gateway', className: 'Inline' },
    );

    await expect(gateway.call()).rejects.toThrow();

    expect(tracing.span('gateway.Inline.call').attributes).not.toHaveProperty('error.type');
  });

  it('leaves getters, symbols, generators and lifecycle hooks alone', async () => {
    const wrapped = repository();

    expect(wrapped.size).toBe(1);
    expect([...wrapped.ids()]).toEqual(['acc-1']);
    for await (const id of wrapped.stream()) expect(id).toBe('acc-1');
    await wrapped.onModuleInit();
    await wrapped[Symbol.asyncDispose]();

    expect(wrapped.initialised).toBe(true);
    expect(tracing.spans()).toHaveLength(0);
  });

  it('lets the list of lifecycle hooks be configured', async () => {
    configureTracing({ lifecycleHooks: ['warmUp'] });
    const wrapped = repository();

    await wrapped.warmUp();
    await wrapped.onModuleInit();

    expect(tracing.spans().map((span) => span.name)).toEqual([
      'repository.AccountRepository.onModuleInit',
    ]);
  });

  it('traces arrow-function properties and inherited methods', async () => {
    class Base {
      async inherited(): Promise<void> {}
    }
    class Gateway extends Base {
      send = async (): Promise<void> => {};
    }
    const gateway = traceDependency(new Gateway(), { kind: 'gateway' });

    await gateway.inherited();
    await gateway.send();

    expect(tracing.spans().map((span) => span.name)).toEqual([
      'gateway.Gateway.inherited',
      'gateway.Gateway.send',
    ]);
  });

  it('fronts a frozen instance with a proxy that keeps instanceof and private members', async () => {
    const frozen = Object.freeze(new AccountRepository());
    const wrapped = traceDependency(frozen, { kind: 'repository' });

    expect(wrapped).toBeInstanceOf(AccountRepository);
    await expect(wrapped.findBalance('acc-1')).resolves.toBe(100);
    expect(wrapped.size).toBe(1);
    expect(traceDependency(wrapped, { kind: 'repository' })).toBe(wrapped);
    expect(tracing.spans()).toHaveLength(1);
  });

  it('nests dependency spans under the active span', async () => {
    const wrapped = repository();

    await withSpan('request', () => wrapped.findBalance('acc-1'));

    const parent = tracing.span('request');
    const child = tracing.span('repository.AccountRepository.findBalance');
    expect(child.parentSpanContext?.spanId).toBe(parent.spanContext().spanId);
  });

  describe('per-root cap', () => {
    it('stops tracing a name beyond the per-name cap and counts the dropped calls on the root', async () => {
      configureTracing({ maxSpansPerName: 3 });
      const wrapped = repository();
      let lastBalance: number | undefined;

      await withSpan('request', async () => {
        for (let call = 0; call < 5; call += 1) lastBalance = await wrapped.findBalance('acc-1');
        await wrapped.warmUp();
      });

      const names = tracing.spans().map((span) => span.name);
      expect(names.filter((name) => name.endsWith('findBalance'))).toHaveLength(3);
      expect(names.filter((name) => name.endsWith('warmUp'))).toHaveLength(1);
      expect(lastBalance).toBe(100);
      expect(tracing.span('request').attributes[DROPPED_SPANS_ATTRIBUTE]).toBe(2);
    });

    it('stops tracing beyond the total cap', async () => {
      configureTracing({ maxSpansPerRoot: 2 });
      const wrapped = repository();

      await withSpan('request', async () => {
        await wrapped.findBalance('acc-1');
        await wrapped.warmUp();
        await wrapped.debit('acc-1', 1);
      });

      expect(tracing.spans()).toHaveLength(3);
      expect(tracing.span('request').attributes[DROPPED_SPANS_ATTRIBUTE]).toBe(1);
    });

    it('defaults to 25 spans per name', async () => {
      const wrapped = repository();

      await withSpan('request', async () => {
        for (let call = 0; call < 30; call += 1) await wrapped.findBalance('acc-1');
      });

      expect(tracing.spans()).toHaveLength(26);
      expect(tracing.span('request').attributes[DROPPED_SPANS_ATTRIBUTE]).toBe(5);
    });

    it('counts each local root separately', async () => {
      configureTracing({ maxSpansPerName: 1 });
      const wrapped = repository();

      await withSpan('first', () => wrapped.findBalance('acc-1'));
      await withSpan('second', () => wrapped.findBalance('acc-1'));

      expect(tracing.spans()).toHaveLength(4);
    });

    it('is not applied when the tracker is not installed', async () => {
      tracing.teardown();
      tracing = setupTracing();
      configureTracing({ maxSpansPerName: 1 });
      const wrapped = repository();

      await withSpan('request', async () => {
        for (let call = 0; call < 4; call += 1) await wrapped.findBalance('acc-1');
      });

      expect(tracing.spans()).toHaveLength(5);
      expect(tracing.span('request').attributes).not.toHaveProperty(DROPPED_SPANS_ATTRIBUTE);
    });
  });
});

describe('traceUseCase', () => {
  it('traces a handler as a use case of its context', async () => {
    const tracing = setupTracing();
    class PlaceOrderHandler {
      async execute(): Promise<string> {
        return 'order-1';
      }
    }

    await traceUseCase(new PlaceOrderHandler(), { context: 'ordering' }).execute();

    const span = tracing.span('use-case.PlaceOrderHandler.execute');
    expect(span.attributes['app.dependency.kind']).toBe('use-case');
    expect(span.attributes['app.context']).toBe('ordering');
    tracing.teardown();
  });
});

describe('withSpan', () => {
  let tracing: TestTracing;

  beforeEach(() => {
    tracing = setupTracing();
  });

  afterEach(() => tracing.teardown());

  it('runs a synchronous function in a span carrying the given attributes', () => {
    const result = withSpan('startup.migrations', () => trace.getActiveSpan() !== undefined, {
      'app.step': 'migrate',
    });

    expect(result).toBe(true);
    expect(tracing.span('startup.migrations').attributes).toEqual({ 'app.step': 'migrate' });
  });

  it('ends the span when the promise settles and scrubs the failure', async () => {
    await expect(
      withSpan('job', async () => {
        throw new RangeError('user 42 is out of range');
      }),
    ).rejects.toThrow(RangeError);

    const span = tracing.span('job');
    expect(span.status).toEqual({ code: SpanStatusCode.ERROR });
    expect(span.attributes).toEqual({ 'error.type': 'RangeError' });
    expect(span.events).toHaveLength(0);
  });
});
