import type { ImportTarget } from './import-target.js';

export interface ResolvedImport {
  readonly specifier: string;
  readonly line: number;
  /** Local names bound by the statement. */
  readonly names: readonly string[];
  /** The names among them that are imported as types only. */
  readonly typeNames: readonly string[];
  readonly target: ImportTarget;
}
