import { identifier } from '../text/identifier.js';
import type { LocalType } from './local-types.js';

/**
 * The types of a file reached from the texts given: the ones they name, then the ones those name.
 * A text approximation of "the types of a signature": a name counts wherever it occurs.
 */
export function typeClosure(texts: readonly string[], types: readonly LocalType[]): ReadonlySet<string> {
  const reached = new Set<string>();
  const pending = [...texts];

  for (let at = 0; at < pending.length; at += 1) {
    const text = pending[at] ?? '';

    for (const type of types) {
      if (reached.has(type.name) || !identifier(type.name).test(text)) continue;

      reached.add(type.name);
      pending.push(type.text);
    }
  }

  return reached;
}
