import type { CachePurger } from '../../application/ports/cache-purger';

export interface RepeatedCachePurgerOptions {
  /** How long after a purge the same tags are purged again: longer than the slowest read of the application. */
  readonly againAfterMs: number;
  /** Waits that long. Defaults to a timer that keeps no process alive; a test hands a wait it releases. */
  readonly wait?: (ms: number) => Promise<void>;
  /** Told of a second purge that failed: the first one was confirmed, and nothing retries the second. */
  readonly onFailure?: (error: unknown, tags: readonly string[]) => void;
}

/**
 * Purges, then purges the same tags once more a little later. A read that loaded the previous
 * state before the commit can reach the cache after the first purge, and be kept as fresh for
 * its whole `s-maxage`: the second purge removes it. The first purge is the one the relay waits
 * for and retries; the second is best effort, and lost if the process stops before it.
 *
 *     new PurgingPublisher(new RepeatedCachePurger(varnish, { againAfterMs: 2_000 }), broker)
 */
export class RepeatedCachePurger implements CachePurger {
  constructor(
    private readonly purger: CachePurger,
    private readonly options: RepeatedCachePurgerOptions,
  ) {}

  async purge(tags: readonly string[]): Promise<void> {
    await this.purger.purge(tags);

    if (tags.length > 0) {
      void this.purgeAgain(tags);
    }
  }

  private async purgeAgain(tags: readonly string[]): Promise<void> {
    try {
      await (this.options.wait ?? sleep)(this.options.againAfterMs);
      await this.purger.purge(tags);
    } catch (error) {
      this.options.onFailure?.(error, tags);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms).unref();
  });
}
