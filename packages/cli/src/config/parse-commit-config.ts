import type { CommitConfig } from './commit-config.js';
import { parseCommitLimits } from './parse-commit-limits.js';
import { isRecord } from './values/is-record.js';

/** The limits as `parseCommitLimits` reads them; `agentTrailer` is true only when written `true`: `config/valid` reports another value. */
export function parseCommitConfig(value: unknown): CommitConfig {
  return { ...parseCommitLimits(value), agentTrailer: isRecord(value) && value['agentTrailer'] === true };
}
