import type { Kind } from '../generate/kind';
import { SHARED_WRITES } from '../generate/shared-writes';

/**
 * The kinds a worker confined to one context may run: those of a context that write nothing
 * shared, and those that have a way not to (a decision record of its slices, for one).
 */
export function workerGenerators(kinds: readonly Kind[]): string[] {
  return kinds
    .filter((kind) => kind.positionals[0] === 'context' || SHARED_WRITES[kind.name]?.worker !== undefined)
    .flatMap((kind) => {
      if (!kind.writesShared) {
        return [kind.name];
      }

      const allowed = SHARED_WRITES[kind.name]?.worker;

      return allowed === undefined ? [] : [`${kind.name} (${allowed})`];
    });
}
