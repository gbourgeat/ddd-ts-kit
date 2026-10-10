import type { ImportRecord } from './import-record.js';
import { statementOf } from './statement-of.js';
import type { StringRecord } from './string-record.js';

/** The import and export statements of a blanked source: one record per string literal that is a module specifier. */
export function findImports(
  code: string,
  strings: readonly StringRecord[],
  lineAt: (offset: number) => number,
): ImportRecord[] {
  return strings.flatMap((literal) => {
    const found = statementOf(code, literal);

    return found === undefined ? [] : [{ ...found.record, specifier: literal.value, line: lineAt(found.offset) }];
  });
}
