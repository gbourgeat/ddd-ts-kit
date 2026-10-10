import { describe, expect, it } from 'vitest';
import {
  allOf,
  anyOf,
  compose,
  forClasses,
  forContext,
  forKinds,
  forMethods,
  not,
  when,
  type Aspect,
} from '../src/index.js';
import { QuoteGateway } from './support/quote-gateway.js';
import { recording } from './support/recording.js';

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

    await gateway.quote('EUR-USD');

    expect(journal.map((line) => line.split(' ')[0])).toEqual(['outer', 'inner', 'inner', 'outer']);
    expect(gateway.calls).toEqual(['quote:EUR-USD']);
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
