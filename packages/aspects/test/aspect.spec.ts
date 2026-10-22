import { describe, expect, it } from 'vitest';
import { LIFECYCLE_HOOKS, defineAspect, type JoinPoint } from '../src';
import { PROBE } from './support/probe';
import { QuoteGateway } from './support/quote-gateway';
import { recording } from './support/recording';

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
});

describe('the advice of an aspect', () => {
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
