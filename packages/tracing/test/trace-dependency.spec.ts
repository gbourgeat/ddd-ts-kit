import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  LocalRootTracker,
  configureTracing,
  resetTracingConfiguration,
  traceDependency,
  withSpan,
} from '../src/index.js';
import { AccountRepository } from './support/account-repository.js';
import { setupTracing, type TestTracing } from './support/setup-tracing.js';
import { tracedRepository as repository } from './support/traced-repository.js';

describe('traceDependency', () => {
  let tracing: TestTracing;

  beforeEach(() => {
    tracing = setupTracing([new LocalRootTracker()]);
  });

  afterEach(() => {
    tracing.teardown();
    resetTracingConfiguration();
  });

  it('names the span after kind, class and method and describes the dependency', async () => {
    await repository().findBalance('acc-1');

    const span = tracing.span('repository AccountRepository.findBalance');

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
      'repository AccountRepository.findBalance',
    ]);
  });

  it('uses the given class name when the constructor name cannot be trusted', async () => {
    const wrapped = traceDependency(new AccountRepository(), {
      kind: 'gateway',
      className: 'Accounts',
    });

    await wrapped.findBalance('acc-1');

    expect(tracing.span('gateway Accounts.findBalance').attributes['code.namespace']).toBe('Accounts');
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
      'repository AccountRepository.lazyCount',
    ]);
  });

  it('nests dependency spans under the active span', async () => {
    const wrapped = repository();

    await withSpan('request', () => wrapped.findBalance('acc-1'));

    const parent = tracing.span('request');
    const child = tracing.span('repository AccountRepository.findBalance');

    expect(child.parentSpanContext?.spanId).toBe(parent.spanContext().spanId);
  });
});

describe('traceDependency, what it wraps', () => {
  let tracing: TestTracing;

  beforeEach(() => {
    tracing = setupTracing([new LocalRootTracker()]);
  });

  afterEach(() => {
    tracing.teardown();
    resetTracingConfiguration();
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
      'repository AccountRepository.onModuleInit',
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
      'gateway Gateway.inherited',
      'gateway Gateway.send',
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
});
