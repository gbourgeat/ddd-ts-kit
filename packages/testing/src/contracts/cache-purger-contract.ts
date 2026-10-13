import { cacheTag, tenantCacheTags, type CachePurger } from '@ddd-ts-kit/kernel';
import type { Awaitable } from './awaitable.js';
import type { ContractRunner } from './contract-runner.js';
import { ContractSuite } from './contract-suite.js';

/** A shared cache with its purger: answers are filed under tags through the cache itself, then purged. */
export interface CachePurgerUnderContract {
  readonly purger: CachePurger;
  /** Has the cache keep an answer under `key`, filed under `tags`. */
  store(key: string, tags: readonly string[]): Awaitable<void>;
  /** Whether the cache still serves the answer under `key` without asking the application. */
  holds(key: string): Awaitable<boolean>;
}

export interface CachePurgerContractOptions {
  readonly name: string;
  /** A cache holding nothing yet, or nothing under the keys of the test; called before each test. */
  createCache(): Awaitable<CachePurgerUnderContract>;
}

/** What every adapter of the kernel `CachePurger` port guarantees, the in-memory one included. */
export function cachePurgerContract(runner: ContractRunner, options: CachePurgerContractOptions): void {
  new CachePurgerSuite(runner, options).describe(`${options.name} (cache purger contract)`);
}

const MONDAY = cacheTag('calendar', 'c-1');
const TUESDAY = cacheTag('calendar', 'c-2');
const EVERY_CALENDAR = cacheTag('calendar');

class CachePurgerSuite extends ContractSuite<CachePurgerUnderContract> {
  constructor(runner: ContractRunner, options: CachePurgerContractOptions) {
    super(runner, () => options.createCache());
  }

  protected tests(): void {
    this.purgesWhatATagNames();
    this.isIdempotent();
  }

  private purgesWhatATagNames(): void {
    this.it('purges the answers filed under a tag, and only those', async () => {
      await this.subject.store('/calendars/c-1', [MONDAY, EVERY_CALENDAR]);
      await this.subject.store('/calendars/c-2', [TUESDAY, EVERY_CALENDAR]);

      await this.subject.purger.purge([MONDAY]);

      this.expect(await this.subject.holds('/calendars/c-1')).toBe(false);
      this.expect(await this.subject.holds('/calendars/c-2')).toBe(true);
    });

    this.it('purges the answers filed under any of several tags, a kind reaching each of its elements', async () => {
      await this.subject.store('/calendars/c-1', [MONDAY, EVERY_CALENDAR]);
      await this.subject.store('/calendars/c-2', [TUESDAY, EVERY_CALENDAR]);
      await this.subject.store('/calendars', [EVERY_CALENDAR]);

      await this.subject.purger.purge([EVERY_CALENDAR]);

      this.expect(await this.subject.holds('/calendars/c-1')).toBe(false);
      this.expect(await this.subject.holds('/calendars/c-2')).toBe(false);
      this.expect(await this.subject.holds('/calendars')).toBe(false);
    });

    this.it('keeps the answers of another tenant', async () => {
      const [ofAcme = MONDAY, ofGlobex = MONDAY] = [
        ...tenantCacheTags([MONDAY], 'acme'),
        ...tenantCacheTags([MONDAY], 'globex'),
      ];

      await this.subject.store('/acme/calendars/c-1', [ofAcme]);
      await this.subject.store('/globex/calendars/c-1', [ofGlobex]);

      await this.subject.purger.purge([ofAcme]);

      this.expect(await this.subject.holds('/acme/calendars/c-1')).toBe(false);
      this.expect(await this.subject.holds('/globex/calendars/c-1')).toBe(true);
    });
  }

  private isIdempotent(): void {
    this.it('purges nothing for a tag nothing is filed under, an empty list, or a second time', async () => {
      await this.subject.store('/calendars/c-2', [TUESDAY]);

      await this.subject.purger.purge([cacheTag('calendar', 'unknown')]);
      await this.subject.purger.purge([]);
      await this.subject.purger.purge([MONDAY]);
      await this.subject.purger.purge([MONDAY]);

      this.expect(await this.subject.holds('/calendars/c-2')).toBe(true);
    });
  }
}
