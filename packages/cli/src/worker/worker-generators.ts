import type { Kind } from '../generate/kind.js';
import { SHARED_WRITES } from '../generate/shared-writes.js';

/** The kinds a worker confined to one context may run: those that write nothing shared, and those that have a way not to. */
export function workerGenerators(kinds: readonly Kind[]): string[] {
  return kinds
    .filter((kind) => kind.positionals[0] === 'context')
    .flatMap((kind) => {
      if (!kind.writesShared) return [kind.name];

      const allowed = SHARED_WRITES[kind.name]?.worker;

      return allowed === undefined ? [] : [`${kind.name} (${allowed})`];
    });
}
