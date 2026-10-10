import { describe, expect, it } from 'vitest';
import { compose, logged, retry, timed, type Aspect } from '../src/index.js';
import { createAspectFakes, withAspectRuntime } from '../src/testing.js';
import { LedgerGateway } from './support/ledger-gateway.js';
import { recording } from './support/recording.js';
import { settled } from './support/settled.js';
import { Unreachable } from './support/unreachable.js';

const STANDINGS: readonly [string, <T extends object>(instance: T) => T][] = [
  ['an extensible instance', (instance) => instance],
  ['a frozen instance', (instance) => Object.freeze(instance)],
];

const always = (failure: () => unknown, times = 20): unknown[] => Array.from({ length: times }, failure);

describe.each(STANDINGS)('an aspect and the calls an instance makes on itself: %s', (_standing, prepared) => {
  const wrap = (aspect: Aspect, ledger = new LedgerGateway()): LedgerGateway => aspect(prepared(ledger));

  it('makes the attempts it was asked for when a public method goes through a private step', async () => {
    const ledger = wrap(
      retry({ attempts: 3, sleep: async () => undefined }),
      new LedgerGateway().failNext(...always(() => new Unreachable())),
    );

    await expect(ledger.post('rent', 900)).rejects.toBeInstanceOf(Unreachable);

    expect(ledger.sendAttempts).toBe(3);
  });

  it('makes them once for a public method that calls another public method', async () => {
    const ledger = wrap(
      retry({ attempts: 3, sleep: async () => undefined }),
      new LedgerGateway().failNext(...always(() => new Unreachable())),
    );

    await expect(ledger.postAll([['rent', 900]])).rejects.toBeInstanceOf(Unreachable);

    expect(ledger.sendAttempts).toBe(3);
  });

  it('logs one start and one end per call from outside', async () => {
    const fakes = createAspectFakes();
    const ledger = wrap(logged());

    await withAspectRuntime(fakes, () =>
      ledger.postAll([
        ['rent', 900],
        ['power', 80],
      ]),
    );

    expect(fakes.logger.entries.map((entry) => entry.message)).toEqual([
      'LedgerGateway.postAll started',
      'LedgerGateway.postAll succeeded',
    ]);
  });

  it('times one call per call from outside', async () => {
    const fakes = createAspectFakes();
    const ledger = wrap(timed());

    await withAspectRuntime(fakes, async () => {
      await ledger.postAll([['rent', 900]]);
      await ledger.post('power', 80);
    });

    expect(
      fakes.metrics.samples.filter((sample) => sample.kind === 'counter').map((sample) => sample.labels?.['method']),
    ).toEqual(['postAll', 'post']);
  });

  it('advises each of two calls made from outside at the same time', async () => {
    const journal: string[] = [];
    const ledger = wrap(recording(journal));

    await Promise.all([ledger.post('rent', 900), ledger.post('power', 80)]);

    expect(journal.filter((line) => line === 'around > LedgerGateway.post')).toHaveLength(2);
    expect(ledger.sendAttempts).toBe(2);
  });

  it('advises again what an advised call left behind, once that call is over', async () => {
    const journal: string[] = [];

    class DeferringLedger extends LedgerGateway {
      readonly deferred: Promise<void>[] = [];

      override async postAll(postings: readonly (readonly [account: string, amount: number])[]): Promise<void> {
        setImmediate(() => {
          for (const [account, amount] of postings) {
            this.deferred.push(this.post(account, amount));
          }
        });
      }
    }

    const ledger = recording(journal)(prepared(new DeferringLedger()));

    await ledger.postAll([['rent', 900]]);
    await settled();
    await Promise.all(ledger.deferred);

    expect(journal).toEqual([
      'around > DeferringLedger.postAll',
      'around < DeferringLedger.postAll',
      'around > DeferringLedger.post',
      'around < DeferringLedger.post',
    ]);
  });

  it('keeps one application apart from another: two aspects on one instance each advise the call from outside once', async () => {
    const journal: string[] = [];

    const ledger = wrap(
      compose(recording(journal, 'outer'), retry({ attempts: 2, sleep: async () => undefined })),
      new LedgerGateway().failNext(new Unreachable()),
    );

    await ledger.postAll([['rent', 900]]);

    expect(journal).toEqual(['outer > LedgerGateway.postAll', 'outer < LedgerGateway.postAll']);
    expect(ledger.sendAttempts).toBe(2);
    expect(ledger.posted).toBe(1);
  });
});

describe('an aspect and the calls another instance makes', () => {
  it('advises the other instance, and takes a call that comes back from it for the inside of the call in progress', async () => {
    const journal: string[] = [];
    const aspect = recording(journal);

    class Auditor {
      constructor(private readonly ledger: LedgerGateway) {}

      async audit(): Promise<number> {
        return this.ledger.balance();
      }
    }

    class AuditedLedger extends LedgerGateway {
      readonly auditor = aspect(new Auditor(this));

      override async post(account: string, amount: number): Promise<void> {
        await super.post(account, amount);
        await this.auditor.audit();
      }
    }

    await aspect(new AuditedLedger()).post('rent', 900);

    expect(journal).toEqual([
      'around > AuditedLedger.post',
      'around > Auditor.audit',
      'around < Auditor.audit',
      'around < AuditedLedger.post',
    ]);
  });
});
