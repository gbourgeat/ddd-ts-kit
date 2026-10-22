import type { CommitConfig } from './commit-config';
import { parseCommitLimits } from './parse-commit-limits';
import { isRecord } from './values/is-record';

/** The limits as `parseCommitLimits` reads them; `agentTrailer` is true only when written `true`: `config/valid` reports another value. */
export function parseCommitConfig(value: unknown): CommitConfig {
  return { ...parseCommitLimits(value), agentTrailer: isRecord(value) && value['agentTrailer'] === true };
}
