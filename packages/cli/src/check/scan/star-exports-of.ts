import { scan } from './scan';
import { stringAt } from './string-at';

const STAR = /\bexport\s*\*\s*from\s*/g;

/** What a source re-exports whole, comments left out: the module of each `export * from`. */
export function starExportsOf(source: string): string[] {
  return [...scan(source).code.matchAll(STAR)].flatMap(
    (found) => stringAt(source, found.index + found[0].length) ?? [],
  );
}
