import type { Kind } from './kind';
import { flagsOf } from './flags-of';

/**
 * True when a kind takes `--term`, its usage showing it: the names it writes are judged against
 * the glossary of the context, and a word the glossary does not define joins it in the same
 * command (`context` writes the first terms). Every other kind refuses `--term`: what it names
 * an earlier command named, or it is read from the concept it serves (a port, an adapter, a route).
 */
export function heldToGlossary(kind: Kind): boolean {
  return flagsOf(kind).has('term');
}
