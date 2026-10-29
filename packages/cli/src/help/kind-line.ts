import type { Kind } from '../generate/kind';
import { usageOf } from '../generate/usage-of';

/** A kind as the list of the kinds shows it: what follows `ddd-ts-kit generate`, then its aliases. */
export function kindLine(kind: Kind): string {
  return `${usageOf(kind)}${kind.aliases.length > 0 ? `   (alias: ${kind.aliases.join(', ')})` : ''}`;
}
