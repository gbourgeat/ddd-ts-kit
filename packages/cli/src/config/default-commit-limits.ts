import type { CommitLimits } from './commit-limits.js';

/** The same numbers as the editor hook of the plugin: a slice fits in them, a day of work does not. */
export const DEFAULT_COMMIT_LIMITS: CommitLimits = { maxFiles: 20, maxLines: 600 };
