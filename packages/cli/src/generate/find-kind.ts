import type { Kind } from './kind';
import { KINDS } from './kinds';

/** The kind of a name or of one of its aliases. */
export function findKind(name: string): Kind | undefined {
  return KINDS.find((kind) => kind.name === name || kind.aliases.includes(name));
}
