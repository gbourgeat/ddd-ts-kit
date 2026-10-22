import type { CodeEntry } from './code-entry';

/** The closed list of the codes of a context, `export const <Context>Codes = { .. } as const` in `domain/errors/codes.ts`. */
export interface CodeList {
  readonly name: string;
  readonly line: number;
  /** True when the object is declared `as const`, which keeps each code its own literal type. */
  readonly constant: boolean;
  readonly entries: readonly CodeEntry[];
}
