import type { Config, Severity } from '../../config/index.js';
import type { Location } from './location.js';
import type { SourceFile } from './source-file.js';

export interface Project {
  readonly root: string;
  readonly config: Config;
  readonly configText: string;
  /** TypeScript sources under the source root (or the single file of `check-file`). */
  readonly files: readonly SourceFile[];
  /** Every file under the contexts directory, sources or not, relative to the root. */
  readonly contextEntries: readonly string[];
  /** Context directories found on disk. */
  readonly contextsOnDisk: readonly string[];
  severity(ruleId: string): Severity;
  locate(file: string): Location;
}
