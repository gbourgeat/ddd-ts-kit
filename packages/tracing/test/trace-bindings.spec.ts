import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { traceBindings } from '../src/index.js';
import { Ledger } from './support/ledger.js';
import { setupTracing, type TestTracing } from './support/setup-tracing.js';

describe('traceBindings', () => {
  let tracing: TestTracing;

  beforeEach(() => {
    tracing = setupTracing();
  });

  afterEach(() => tracing.teardown());

  it('traces the instance of a binding declared with a kind, under its context', async () => {
    const decorate = traceBindings();
    const ledger = new Ledger();

    const decorated = decorate(ledger, { context: 'billing', kind: 'repository' });

    await decorated.balanceOf('acc-1');

    expect(decorated).toBe(ledger);

    expect(tracing.span('repository.Ledger.balanceOf').attributes).toMatchObject({
      'app.context': 'billing',
      'app.dependency.kind': 'repository',
    });
  });

  it('hands out untouched the instance of a binding declared without a kind', async () => {
    const decorated = traceBindings()(new Ledger(), { context: 'billing' });

    await decorated.balanceOf('acc-1');

    expect(tracing.spans()).toHaveLength(0);
  });

  it('hands out untouched a value that is not an object', () => {
    const decorate = traceBindings();

    expect(decorate('https://collector', { context: 'platform', kind: 'external' })).toBe('https://collector');
    expect(decorate(null, { context: 'platform', kind: 'external' })).toBeNull();
  });
});
