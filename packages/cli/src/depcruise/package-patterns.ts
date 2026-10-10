import { escapePattern } from './escape-pattern.js';

/** A package as resolved in node_modules, as a linked workspace, or as written when it is not installed. */
export function packagePatterns(names: readonly string[]): string[] {
  return names.flatMap((name) => [`(^|/)node_modules/${escapePattern(name)}/`, `^${escapePattern(name)}(/|$)`]);
}
