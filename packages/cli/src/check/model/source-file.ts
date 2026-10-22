import type { Scan } from '../scan/scan';
import type { Structure } from '../structure/read-structure';
import type { Location } from './location';
import type { ResolvedImport } from './resolved-import';

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
