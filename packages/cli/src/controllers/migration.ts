import type { Config } from '../config/index.js';
import type { MigrationDraft } from '../refusals/migration-draft.js';
import type { Workspace } from '../workspace/index.js';

/** What a migration to controllers works on, and what it found on the way. */
export interface Migration {
  readonly ws: Workspace;
  readonly config: Config;
  readonly draft: MigrationDraft;
  /** Files that moved, old path to new path: their imports are rewritten everywhere at the end. */
  readonly renamed: Map<string, string>;
  /** `<Name>Route -> <Name>Controller`, for the report. */
  readonly moved: string[];
  /** Why a context was left as it is, one sentence per route that cannot be turned. */
  readonly blockers: string[];
}
