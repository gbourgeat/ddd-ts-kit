import type { Kind } from './kind';
import { kindHelp, type KindHelp } from './kind-help';

/** Every kind with what it takes and whether it stays inside its context. */
export function kindsHelp(kinds: readonly Kind[]): KindHelp[] {
  return kinds.map((kind) => kindHelp(kind));
}
