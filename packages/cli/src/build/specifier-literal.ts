import type { StringRecord } from '../check/scan/string-record';

/** A string literal of an emitted file that stands where a module specifier is read. */
export interface SpecifierLiteral {
  readonly literal: StringRecord;
  /** False when the literal is only the start of a computed argument, as in `import('@/x/' + name)`. */
  readonly whole: boolean;
}
