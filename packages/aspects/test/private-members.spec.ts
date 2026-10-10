import { describe, expect, it } from 'vitest';
import { compose, retry, type Aspect } from '../src/index.js';
import { LedgerGateway } from './support/ledger-gateway.js';
import { QuoteGateway } from './support/quote-gateway.js';
import { recording } from './support/recording.js';
import { Unreachable } from './support/unreachable.js';

/*
 * The classes of the kit keep their state in TypeScript `private` members, which are ordinary
 * properties and methods once compiled: an aspect reads and wraps them like the public ones.
 * Both ways an aspect stands around an instance are specified: own methods on an extensible
 * instance, a proxy in front of a frozen one.
 */
const STANDINGS: readonly [string, <T extends object>(instance: T) => T][] = [
  ['an extensible instance, wrapped in place', (instance) => instance],
  ['a frozen instance, fronted by a proxy', (instance) => Object.freeze(instance)],
];

describe.each(STANDINGS)('an aspect around a class with private members: %s', (_standing, prepared) => {
  const wrap = (aspect: Aspect, ledger = new LedgerGateway()): LedgerGateway => aspect(prepared(ledger));

  it('lets a method read and change the private state of its instance', async () => {
    const ledger = wrap(recording([]));

    await ledger.post('rent', 900);
    await ledger.post('salary', -2400);

    expect(await ledger.balance()).toBe(-1500);
    expect(ledger.posted).toBe(2);
  });

  it('runs a private method called through this, and advises it like any asynchronous method', async () => {
    const journal: string[] = [];
    const ledger = wrap(recording(journal));

    await ledger.post('rent', 900);

    expect(journal).toEqual([
      'around > LedgerGateway.post',
      'around > LedgerGateway.send',
      'around < LedgerGateway.send',
      'around < LedgerGateway.post',
    ]);
  });

  it('advises a public method another one calls through this', async () => {
    const journal: string[] = [];
    const ledger = wrap(recording(journal));

    await ledger.postAll([
      ['rent', 900],
      ['power', 80],
    ]);

    expect(journal.filter((line) => line.endsWith('> LedgerGateway.post'))).toHaveLength(2);
    expect(await ledger.balance()).toBe(980);
  });

  it('keeps the private state right across the attempts of a retry', async () => {
    const ledger = wrap(retry({ attempts: 3, sleep: async () => undefined }), new LedgerGateway().failNext(new Unreachable()));

    await ledger.post('rent', 900);

    expect(await ledger.balance()).toBe(900);
    expect(ledger.posted).toBe(1);
  });

  it('nests composed aspects the same way around every method reached through this', async () => {
    const journal: string[] = [];
    const ledger = wrap(compose(recording(journal, 'outer'), recording(journal, 'inner')));

    await ledger.post('rent', 900);

    expect(journal.map((line) => line.split('.')[0])).toEqual([
      'outer > LedgerGateway',
      'inner > LedgerGateway',
      'outer > LedgerGateway',
      'inner > LedgerGateway',
      'inner < LedgerGateway',
      'outer < LedgerGateway',
      'inner < LedgerGateway',
      'outer < LedgerGateway',
    ]);
  });
});

describe('an aspect around a frozen instance', () => {
  it('fronts it with a proxy of the same type', async () => {
    const journal: string[] = [];
    const frozen = Object.freeze(new QuoteGateway());

    const wrapped = recording(journal)(frozen);

    expect(wrapped).not.toBe(frozen);
    expect(wrapped).toBeInstanceOf(QuoteGateway);
    expect(await wrapped.quote('EUR-USD')).toEqual({ pair: 'EUR-USD', rate: 1.08 });
    expect(wrapped.rate).toBe(1.08);
    expect(journal).toHaveLength(2);
  });

  it('cannot give it back the right to change a field: frozen means frozen for private fields too', async () => {
    const gateway = recording([])(Object.freeze(new QuoteGateway()));

    await expect(gateway.reprice(1.3)).rejects.toBeInstanceOf(TypeError);
    expect(gateway.rate).toBe(1.08);
  });
});
