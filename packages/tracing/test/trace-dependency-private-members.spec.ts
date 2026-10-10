import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { traceDependency } from '../src/index.js';
import { Ledger } from './support/ledger.js';
import { setupTracing, type TestTracing } from './support/setup-tracing.js';

describe('traceDependency, a class with private members', () => {
  let tracing: TestTracing;

  beforeEach(() => {
    tracing = setupTracing();
  });

  afterEach(() => tracing.teardown());

  const spanNames = (): string[] => tracing.spans().map((span) => span.name);

  it('lets methods read private fields and call private methods through this', async () => {
    const ledger = traceDependency(new Ledger(), { kind: 'repository' });

    await expect(ledger.balanceOf('acc-1')).resolves.toBe(105);
    await expect(ledger.balanceOf('acc-2')).resolves.toBe(0);

    expect(ledger.readCount).toBe(2);
  });

  it('traces a private async method called through this, under the span of its caller', async () => {
    const ledger = traceDependency(new Ledger(), { kind: 'repository' });

    await ledger.balanceOf('acc-1');

    const outer = tracing.span('repository.Ledger.balanceOf');
    const inner = tracing.span('repository.Ledger.pendingOf');

    expect(spanNames()).toEqual(['repository.Ledger.pendingOf', 'repository.Ledger.balanceOf']);
    expect(inner.parentSpanContext?.spanId).toBe(outer.spanContext().spanId);
  });

  it('adds nothing enumerable: a wrapped instance spreads and compares like a bare one', () => {
    const ledger = traceDependency(new Ledger(), { kind: 'repository' });

    expect(Object.keys(ledger)).toEqual(['balances', 'reads']);
    expect(ledger).toEqual(new Ledger());
  });

  it('traces a function held in a private field like any method', async () => {
    class Notifier {
      private readonly deliver = async (): Promise<void> => {};

      async notify(): Promise<void> {
        await this.deliver();
      }
    }

    await traceDependency(new Notifier(), { kind: 'gateway' }).notify();

    expect(spanNames()).toEqual(['gateway.Notifier.deliver', 'gateway.Notifier.notify']);
  });

  it('keeps private members working behind the proxy of a frozen instance', async () => {
    const ledger = traceDependency(Object.freeze(new Ledger()), { kind: 'repository' });

    await expect(ledger.balanceOf('acc-1')).resolves.toBe(105);

    expect(ledger.readCount).toBe(1);
    // Behind a proxy the methods reach each other on the real instance: only the call made
    // from outside is a span.
    expect(spanNames()).toEqual(['repository.Ledger.balanceOf']);
  });

  it('runs a frozen instance with the receiver its built-in parent accepts', async () => {
    class Registry extends Map<string, number> {
      async count(): Promise<number> {
        return this.size;
      }
    }

    const registry = traceDependency(Object.freeze(new Registry([['acc-1', 100]])), { kind: 'gateway' });

    await expect(registry.count()).resolves.toBe(1);
    expect(registry.size).toBe(1);
    expect(spanNames()).toEqual(['gateway.Registry.count']);
  });
});
