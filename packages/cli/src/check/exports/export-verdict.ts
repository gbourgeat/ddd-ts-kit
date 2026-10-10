import type { Exported } from './exported.js';

/** What the exports of a file come to, once the general allowances are applied. */
export interface ExportVerdict {
  /** The exported classes, interfaces and functions, once per name. */
  readonly counted: readonly Exported[];
  /** False when the file counts several and no allowance explains them. */
  readonly explained: boolean;
  /** The exports the file may be named after; empty when no name is expected. */
  readonly mains: readonly Exported[];
}
