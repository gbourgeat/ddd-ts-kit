import { PROSE_OPENING } from './prose-opening';
import { readsAsProse } from './reads-as-prose';

const FRAGMENTS: readonly RegExp[] = [
  /^(?:if|for|while|switch)\s*\(.*\)\s*\{$/,
  /^\}\s*else\b.*\{$/,
  /^(?:else|try|finally)\s*\{$/,
  /^\}\s*catch\b.*\{$/,
  /=>\s*\{$/,
  /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\b.*\{$/,
  /^(?:export\s+)?(?:abstract\s+)?class\s+[\w$]+.*\{$/,
  /^(?:(?:public|private|protected|static|async|override)\s+)+[\w$#]+\s*\(.*\{$/,
];

/** An opening line of a block whose end was not commented out with it, or the reverse. */
export function isFragment(line: string): boolean {
  const text = line.replace(/`[^`]*`/g, '').trim();

  return !PROSE_OPENING.test(text) && !readsAsProse(text) && FRAGMENTS.some((shape) => shape.test(text));
}
