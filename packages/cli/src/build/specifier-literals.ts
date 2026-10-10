import type { Scan } from '../check/scan/scan.js';
import { statementOf } from '../check/scan/statement-of.js';
import type { StringRecord } from '../check/scan/string-record.js';
import type { SpecifierLiteral } from './specifier-literal.js';

/** An ambient module declaration, which a declaration file may hold: `declare module '@/x.js'`. */
const AUGMENTATION = /(?<![\w$.])declare\s+module\s*$/;
const META_RESOLVE = /(?<![\w$.])import\s*\.\s*meta\s*\.\s*resolve\s*\(\s*$/;
const CLOSES_THE_ARGUMENT = /^\s*[),]/;
const NEAR = 80;

/**
 * The string literals of a scanned file that are module specifiers: after `from`, after a bare
 * `import`, as the argument of `import()`, `require()` or `import.meta.resolve()`, and as the
 * name of an ambient module. The scan already told code from comments, strings and regular
 * expressions, so a string that only looks like an import inside one of those is never answered.
 */
export function specifierLiterals({ code, strings }: Pick<Scan, 'code' | 'strings'>): SpecifierLiteral[] {
  return strings.flatMap((literal) => {
    const kind = positionOf(code, literal);

    if (kind === undefined) {
      return [];
    }

    return [{ literal, whole: kind === 'statement' || CLOSES_THE_ARGUMENT.test(code.slice(literal.end)) }];
  });
}

function positionOf(code: string, literal: StringRecord): 'statement' | 'argument' | undefined {
  const before = code.slice(Math.max(0, literal.start - NEAR), literal.start);
  const found = statementOf(code, literal);

  if (found !== undefined) {
    return found.record.kind === 'dynamic' || found.record.kind === 'require' ? 'argument' : 'statement';
  }

  if (META_RESOLVE.test(before)) {
    return 'argument';
  }

  return AUGMENTATION.test(before) ? 'statement' : undefined;
}
