import { cacheKey, type Cache, type CacheKey } from '@ddd-ts-kit/kernel';
import type { Awaitable } from './awaitable';
import type { ContractRunner } from './contract-runner';
import { ContractSuite } from './contract-suite';

export interface CacheContractOptions {
  readonly name: string;
  /** A fresh, empty cache; called before each test. */
  createCache(): Awaitable<Cache>;
  /** Makes the time of the cache pass: advances its clock, or really waits. */
  elapse(ms: number): Awaitable<void>;
}

/** What every adapter of the kernel `Cache` port guarantees, the in-memory one included. */
export function cacheContract(runner: ContractRunner, options: CacheContractOptions): void {
  new CacheSuite(runner, options).describe(`${options.name} (cache contract)`);
}

interface Quote {
  readonly pair: string;
  readonly rate: number;
  readonly sources: readonly string[];
}

class CacheSuite extends ContractSuite<Cache> {
  constructor(
    runner: ContractRunner,
    private readonly options: CacheContractOptions,
  ) {
    super(runner, () => options.createCache());
  }

  protected tests(): void {
    this.readsWhatWasWritten();
    this.forgets();
    this.expires();
  }

  private readsWhatWasWritten(): void {
    this.it('answers undefined for an entry nobody wrote', async () => {
      this.expect(await this.subject.get(quoteOf('EUR/USD'))).toBe(undefined);
    });

    this.it('gives back the value that was written, whatever its shape', async () => {
      await this.subject.set(quoteOf('EUR/USD'), EUR_USD);
      await this.subject.set(cacheKey<number>('count'), 0);
      await this.subject.set(cacheKey<string>('label'), '');
      await this.subject.set(cacheKey<boolean>('flag'), false);
      await this.subject.set(cacheKey<readonly number[]>('list'), [3, 1, 2]);

      this.expect(await this.subject.get(quoteOf('EUR/USD'))).toEqual(EUR_USD);
      this.expect(await this.subject.get(cacheKey<number>('count'))).toBe(0);
      this.expect(await this.subject.get(cacheKey<string>('label'))).toBe('');
      this.expect(await this.subject.get(cacheKey<boolean>('flag'))).toBe(false);
      this.expect(await this.subject.get(cacheKey<readonly number[]>('list'))).toEqual([3, 1, 2]);
    });

    this.it('keeps entries apart, and the last write of one', async () => {
      await this.subject.set(quoteOf('EUR/USD'), EUR_USD);
      await this.subject.set(quoteOf('EUR/GBP'), { ...EUR_USD, pair: 'EUR/GBP' });
      await this.subject.set(quoteOf('EUR/USD'), { ...EUR_USD, rate: 1.09 });

      this.expect((await this.subject.get(quoteOf('EUR/USD')))?.rate).toBe(1.09);
      this.expect((await this.subject.get(quoteOf('EUR/GBP')))?.pair).toBe('EUR/GBP');
    });
  }

  private forgets(): void {
    this.it('forgets a deleted entry, and only that one', async () => {
      await this.subject.set(quoteOf('EUR/USD'), EUR_USD);
      await this.subject.set(quoteOf('EUR/GBP'), EUR_USD);

      await this.subject.delete(quoteOf('EUR/USD'));

      this.expect(await this.subject.get(quoteOf('EUR/USD'))).toBe(undefined);
      this.expect(await this.subject.get(quoteOf('EUR/GBP'))).toEqual(EUR_USD);
    });

    this.it('accepts the deletion of an entry that does not exist', async () => {
      await this.subject.delete(quoteOf('EUR/USD'));

      this.expect(await this.subject.get(quoteOf('EUR/USD'))).toBe(undefined);
    });
  }

  private expires(): void {
    this.it('keeps an entry until its time to live has passed, then answers undefined', async () => {
      await this.subject.set(quoteOf('EUR/USD'), EUR_USD, { ttlMs: 400 });
      await this.subject.set(quoteOf('EUR/GBP'), EUR_USD);
      this.expect(await this.subject.get(quoteOf('EUR/USD'))).toEqual(EUR_USD);

      await this.options.elapse(500);

      this.expect(await this.subject.get(quoteOf('EUR/USD'))).toBe(undefined);
      this.expect(await this.subject.get(quoteOf('EUR/GBP'))).toEqual(EUR_USD);
    });

    this.it('gives an entry written again the time to live of its last write', async () => {
      await this.subject.set(quoteOf('EUR/USD'), EUR_USD, { ttlMs: 100 });
      await this.subject.set(quoteOf('EUR/USD'), EUR_USD);

      await this.options.elapse(200);

      this.expect(await this.subject.get(quoteOf('EUR/USD'))).toEqual(EUR_USD);
    });

    this.it('does not keep an entry whose time to live is zero', async () => {
      await this.subject.set(quoteOf('EUR/USD'), EUR_USD);
      await this.subject.set(quoteOf('EUR/USD'), EUR_USD, { ttlMs: 0 });

      this.expect(await this.subject.get(quoteOf('EUR/USD'))).toBe(undefined);
    });
  }
}

const EUR_USD: Quote = { pair: 'EUR/USD', rate: 1.0842, sources: ['ecb', 'desk'] };

function quoteOf(pair: string): CacheKey<Quote> {
  return cacheKey<Quote>('quote', pair);
}
