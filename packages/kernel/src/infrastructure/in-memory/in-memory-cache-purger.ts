import type { CachePurger } from '../../application/ports/cache-purger';

/**
 * A shared cache in the memory of the process, for tests: `store` files an answer under its
 * tags, `holds` says whether it is still there, `purged` lists every tag purged, in order.
 */
export class InMemoryCachePurger implements CachePurger {
  readonly purged: string[] = [];

  private readonly answers = new Map<string, ReadonlySet<string>>();

  store(key: string, tags: readonly string[]): void {
    this.answers.set(key, new Set(tags));
  }

  holds(key: string): boolean {
    return this.answers.has(key);
  }

  async purge(tags: readonly string[]): Promise<void> {
    this.purged.push(...tags);

    for (const [key, filed] of this.answers) {
      if (tags.some((tag) => filed.has(tag))) {
        this.answers.delete(key);
      }
    }
  }
}
