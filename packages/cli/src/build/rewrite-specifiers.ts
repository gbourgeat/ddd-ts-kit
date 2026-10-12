import { scan } from '../check/scan/scan.js';
import { computedImports } from './computed-imports.js';
import type { Rewritten } from './rewritten.js';
import { specifierLiterals } from './specifier-literals.js';

export interface Rewrite {
  /** What an alias specifier starts with. */
  readonly prefixes: readonly string[];
  /** The relative specifier an alias specifier becomes, or nothing when it names no emitted file. */
  readonly relativeOf: (specifier: string) => string | undefined;
  /** Why a specifier has no relative form, when more is known than that it names no emitted file. */
  readonly problemOf?: (specifier: string) => string;
}

interface Edit {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

/**
 * Turns every alias specifier of an emitted file into the relative one. Only string literals in
 * a module specifier position are touched; a line never gains or loses a line break, so the
 * source map of the file keeps naming the right lines. A file without an alias comes back as is.
 */
export function rewriteSpecifiers(source: string, { prefixes, relativeOf, problemOf = unknown }: Rewrite): Rewritten {
  const scanned = scan(source);
  const edits: Edit[] = [];

  const problems = computedImports(source, scanned, prefixes).map(
    (line) =>
      `line ${line}: a dynamic import is given a template that starts with an alias and is completed at run time`,
  );

  for (const { literal, whole } of specifierLiterals(scanned)) {
    if (!prefixes.some((prefix) => literal.value.startsWith(prefix))) {
      continue;
    }

    const relative = whole ? relativeOf(literal.value) : undefined;

    if (relative === undefined) {
      problems.push(`line ${literal.line}: ${whole ? problemOf(literal.value) : computed(literal.value)}`);
    } else {
      edits.push({ start: literal.start + 1, end: literal.end - 1, text: relative });
    }
  }

  return { text: applied(source, edits), count: edits.length, problems };
}

const unknown = (specifier: string): string => `"${specifier}" names no file the build emitted`;

const computed = (specifier: string): string =>
  `a dynamic import starts with "${specifier}" and is completed at run time`;

function applied(source: string, edits: readonly Edit[]): string {
  return edits.reduceRight((text, edit) => text.slice(0, edit.start) + edit.text + text.slice(edit.end), source);
}
