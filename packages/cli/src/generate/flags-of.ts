import type { Kind } from './kind';
import { usageOf } from './usage-of';

/** The flags the usage of a kind shows, by their names without the dashes: `module` on the kinds that take it. */
export function flagsOf(kind: Kind): Set<string> {
  return new Set([...usageOf(kind).matchAll(/--([a-z-]+)/g)].flatMap((match) => match[1] ?? []));
}
