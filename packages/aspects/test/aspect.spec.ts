import { describe, expect, it } from 'vitest';
import {
  LIFECYCLE_HOOKS,
  allOf,
  anyOf,
  compose,
  defineAspect,
  forClasses,
  forContext,
  forKinds,
  forMethods,
  not,
  when,
  type Aspect,
  type JoinPoint,
} from '../src/index.js';
import { PROBE, QuoteGateway } from './support/adapters.js';

/** An aspect that writes what it sees around each call: enough to observe the weaving. */
function recording(journal: string[], label = 'around'): Aspect {
  return defineAspect((joinPoint) => async ({ proceed }) => {
    journal.push(`${label} > ${joinPoint.className}.${joinPoint.method}`);
    try {
      return await proceed();
    } finally {
      journal.push(`${label} < ${joinPoint.className}.${joinPoint.method}`);
    }
  });
}

describe('an aspect applied to an instance', () => {
  it('answers the same object, still an instance of its class', () => {
    const gateway = new QuoteGateway();

    const wrapped = recording([])(gateway);

    expect(wrapped).toBe(gateway);
    expect(wrapped).toBeInstanceOf(QuoteGateway);
  });

  it('runs around asynchronous methods, which keep this and their private state', async () => {
    const journal: string[] = [];
    const gateway = recording(journal)(new QuoteGateway());

    await gateway.reprice(1.2);

    expect(await gateway.quote('EUR-USD')).toEqual({ pair: 'EUR-USD', rate: 1.2 });
    expect(journal).toEqual([
      'around > QuoteGateway.reprice',
      'around < QuoteGateway.reprice',
      'around > QuoteGateway.quote',
      'around < QuoteGateway.quote',
    ]);
  });

  it('keeps the name and the declared parameters of a wrapped method', () => {
    const gateway = recording([])(new QuoteGateway());

    expect(gateway.quote.name).toBe('quote');
    expect(gateway.quote).toHaveLength(1);
  });

  it('leaves synchronous methods, getters, generators, symbols and lifecycle hooks alone', async () => {
    const journal: string[] = [];
    const gateway = recording(journal)(new QuoteGateway());

    expect(gateway.describe()).toBe('quotes at 1.08');
    expect(gateway.rate).toBe(1.08);
    expect([...gateway.pairs()]).toEqual(['EUR-USD']);
    expect(await gateway[PROBE]()).toBe('probed');
    expect(await gateway.onModuleInit()).toBe('initialized');
    expect(LIFECYCLE_HOOKS).toContain('onModuleInit');
    expect(journal).toEqual([]);
  });

  it('advises a method that merely returns a promise from its second call', async () => {
    class LateGateway {
      readonly calls: string[] = [];

      quoteLater(pair: string): Promise<string> {
        this.calls.push(`quoteLater:${pair}`);
        return Promise.resolve(pair);
      }
    }
    const journal: string[] = [];
    const gateway = recording(journal)(new LateGateway());

    await gateway.quoteLater('EUR-USD');
    expect(journal).toEqual([]);
    await gateway.quoteLater('EUR-GBP');

    expect(journal).toEqual(['around > LateGateway.quoteLater', 'around < LateGateway.quoteLater']);
    expect(gateway.calls).toEqual(['quoteLater:EUR-USD', 'quoteLater:EUR-GBP']);
  });

  it('is a no-op the second time', async () => {
    const journal: string[] = [];
    const aspect = recording(journal);
    const gateway = aspect(aspect(new QuoteGateway()));

    await gateway.quote('EUR-USD');

    expect(journal).toHaveLength(2);
  });

  it('fronts a frozen instance with a proxy of the same type', async () => {
    const journal: string[] = [];
    const frozen = Object.freeze(new QuoteGateway());

    const wrapped = recording(journal)(frozen);

    expect(wrapped).not.toBe(frozen);
    expect(wrapped).toBeInstanceOf(QuoteGateway);
    expect(await wrapped.quote('EUR-USD')).toEqual({ pair: 'EUR-USD', rate: 1.08 });
    expect(wrapped.rate).toBe(1.08);
    expect(journal).toHaveLength(2);
  });

  it('tells the advice what the composition root knows', () => {
    const seen: JoinPoint[] = [];
    const spying = defineAspect((joinPoint) => {
      seen.push(joinPoint);
      return undefined;
    });
    const gateway = new QuoteGateway();

    spying(gateway, { kind: 'external', context: 'pricing', token: 'pricing.Quotes', className: 'Quotes' });

    expect(seen.find((joinPoint) => joinPoint.method === 'quote')).toEqual({
      instance: gateway,
      className: 'Quotes',
      method: 'quote',
      arity: 1,
      kind: 'external',
      context: 'pricing',
      token: 'pricing.Quotes',
    });
  });

  it('passes the arguments an advice changed', async () => {
    const upperCased = defineAspect(
      () =>
        ({ args, proceed }) =>
          proceed(args.map((arg) => (typeof arg === 'string' ? arg.toUpperCase() : arg))),
    );
    const gateway = upperCased(new QuoteGateway());

    expect(await gateway.quote('eur-usd')).toMatchObject({ pair: 'EUR-USD' });
  });
});

describe('compose', () => {
  it('nests the aspects, the first outermost', async () => {
    const journal: string[] = [];
    const gateway = compose(recording(journal, 'outer'), recording(journal, 'inner'))(new QuoteGateway());

    await gateway.quote('EUR-USD');

    expect(journal).toEqual([
      'outer > QuoteGateway.quote',
      'inner > QuoteGateway.quote',
      'inner < QuoteGateway.quote',
      'outer < QuoteGateway.quote',
    ]);
  });

  it('nests them the same way around a frozen instance', async () => {
    const journal: string[] = [];
    const gateway = compose(
      recording(journal, 'outer'),
      recording(journal, 'inner'),
    )(Object.freeze(new QuoteGateway()));

    await gateway.reprice(1.3);

    expect(journal.map((line) => line.split(' ')[0])).toEqual(['outer', 'inner', 'inner', 'outer']);
    expect(gateway.rate).toBe(1.3);
  });

  it('nests around a method that merely returns a promise once it is known to', async () => {
    class LaterGateway {
      quoteLater(pair: string): Promise<string> {
        return Promise.resolve(pair);
      }
    }
    const journal: string[] = [];
    const gateway = compose(recording(journal, 'outer'), recording(journal, 'inner'))(new LaterGateway());

    await gateway.quoteLater('EUR-USD');
    await gateway.quoteLater('EUR-USD');

    expect(journal.map((line) => line.split(' ')[0])).toEqual(['outer', 'inner', 'inner', 'outer']);
  });
});

describe('when', () => {
  const methodsReached = async (aspectOf: (journal: string[]) => Aspect): Promise<string[]> => {
    const journal: string[] = [];
    const gateway = aspectOf(journal)(new QuoteGateway(), { kind: 'external', context: 'pricing' });
    await gateway.quote('EUR-USD');
    await gateway.reprice(1.1);
    return journal.filter((line) => line.includes('>')).map((line) => line.split('.')[1] ?? '');
  };

  it('selects methods by name', async () => {
    expect(await methodsReached((journal) => when(forMethods('quo*'), recording(journal)))).toEqual(['quote']);
    expect(await methodsReached((journal) => when(forMethods('*ice', 'quote'), recording(journal)))).toEqual([
      'quote',
      'reprice',
    ]);
    expect(await methodsReached((journal) => when(forMethods('quot'), recording(journal)))).toEqual([]);
  });

  it('selects instances by kind, context and class', async () => {
    expect(await methodsReached((journal) => when(forKinds('repository'), recording(journal)))).toEqual([]);
    expect(await methodsReached((journal) => when(forKinds('gateway', 'external'), recording(journal)))).toEqual([
      'quote',
      'reprice',
    ]);
    expect(await methodsReached((journal) => when(forContext('billing'), recording(journal)))).toEqual([]);
    expect(await methodsReached((journal) => when(forClasses('*Gateway'), recording(journal)))).toEqual([
      'quote',
      'reprice',
    ]);
  });

  it('combines selectors', async () => {
    const reads = allOf(forKinds('external'), forMethods('quote'));

    expect(await methodsReached((journal) => when(reads, recording(journal)))).toEqual(['quote']);
    expect(await methodsReached((journal) => when(not(reads), recording(journal)))).toEqual(['reprice']);
    expect(
      await methodsReached((journal) => when(anyOf(forContext('billing'), forMethods('reprice')), recording(journal))),
    ).toEqual(['reprice']);
  });

  it('never matches a kind or a context the instance does not have', async () => {
    const journal: string[] = [];
    const gateway = when(anyOf(forKinds('external'), forContext('pricing')), recording(journal))(new QuoteGateway());

    await gateway.quote('EUR-USD');

    expect(journal).toEqual([]);
  });

  it('refuses a plain function, whose methods it cannot select', () => {
    const plain: Aspect = (instance) => instance;

    expect(() => when(forMethods('find*'), plain)).toThrow(TypeError);
  });
});
