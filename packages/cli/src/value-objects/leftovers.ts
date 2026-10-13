import { scan } from '../check/scan/scan.js';

const STILL_A_RESULT = /(?<![\w$.])unwrap\s*\(|\bok:\s*(?:true|false)\b|\.ok\b|(?<![\w$.])(?:err|ok)\s*\(/g;

/**
 * The lines of a source that may still treat a factory as returning a `Result`, in a file that
 * names one of the value objects that changed: what the migration could not rewrite alone.
 */
export function leftovers(file: string, source: string, classes: ReadonlySet<string>): string[] {
  const scanned = scan(source);
  const names = [...scanned.code.matchAll(/(?<![\w$.])[A-Z][\w$]*/g)].map(([name]) => name);

  if (!names.some((name) => classes.has(name))) {
    return [];
  }

  const lines = new Set([...scanned.code.matchAll(STILL_A_RESULT)].map((found) => scanned.lineAt(found.index)));

  return [...lines].map(
    (line) => `${file}:${line} may still read a Result: rewrite it for a factory that returns the value or throws.`,
  );
}
