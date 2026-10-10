import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DROPPED_SPANS_ATTRIBUTE,
  LocalRootTracker,
  configureTracing,
  resetTracingConfiguration,
  withSpan,
} from '../src/index.js';
import { setupTracing, type TestTracing } from './support/setup-tracing.js';
import { tracedRepository as repository } from './support/traced-repository.js';

describe('traceDependency, the per-root cap', () => {
  let tracing: TestTracing;

  beforeEach(() => {
    tracing = setupTracing([new LocalRootTracker()]);
  });

  afterEach(() => {
    tracing.teardown();
    resetTracingConfiguration();
  });

  it('stops tracing a name beyond the per-name cap and counts the dropped calls on the root', async () => {
    configureTracing({ maxSpansPerName: 3 });
    const wrapped = repository();
    let lastBalance: number | undefined;

    await withSpan('request', async () => {
      for (let call = 0; call < 5; call += 1) {
        lastBalance = await wrapped.findBalance('acc-1');
      }

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
      for (let call = 0; call < 30; call += 1) {
        await wrapped.findBalance('acc-1');
      }
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
      for (let call = 0; call < 4; call += 1) {
        await wrapped.findBalance('acc-1');
      }
    });

    expect(tracing.spans()).toHaveLength(5);
    expect(tracing.span('request').attributes).not.toHaveProperty(DROPPED_SPANS_ATTRIBUTE);
  });
});
