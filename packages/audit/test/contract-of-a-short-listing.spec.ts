import { describe, expect, it } from 'vitest';
import { InMemoryAuditTrail } from '../src';
import { auditTrailContract } from '../src/testing';

/** A trail that lists the first entry of a chain and loses the others. */
class ShortListing extends InMemoryAuditTrail {
  override async search(...request: Parameters<InMemoryAuditTrail['search']>) {
    const page = await super.search(...request);

    return { ...page, items: page.items.slice(0, 1) };
  }
}

describe('the audit trail contract on a trail that loses entries of its listing', () => {
  it('says which entry was not listed instead of tampering with nothing', async () => {
    const tests = new Map<string, () => Promise<void>>();
    const setups: (() => Promise<void>)[] = [];

    const runner = {
      expect,
      describe: (_name: string, suite: () => void) => suite(),
      it: (name: string, test: () => Promise<void>) => void tests.set(name, test),
      beforeEach: (setup: () => Promise<void>) => void setups.push(setup),
    };

    auditTrailContract(runner, {
      name: 'ShortListing',
      createTrail: () => new ShortListing(),
      tamper: () => undefined,
    });

    await Promise.all(setups.map((setup) => setup()));

    await expect(tests.get('shows an entry rewritten in the storage itself')?.()).rejects.toThrow(
      'The second entry of the chain was not listed',
    );
  });
});
