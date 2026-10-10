import type { Scan } from '../scan/scan.js';
import type { Structure } from '../structure/read-structure.js';
import type { Location } from './location.js';
import type { ResolvedImport } from './resolved-import.js';

export interface SourceFile {
  /** Posix path relative to the project root. */
  readonly path: string;
  readonly location: Location;
  readonly isTest: boolean;
  readonly text: string;
  readonly scan: Scan;
  readonly imports: readonly ResolvedImport[];
  /** Declarations, read on first use: only some rules need them. */
  readonly structure: Structure;
}
