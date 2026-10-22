import type { CommitLimits } from './commit-limits';
import { DEFAULT_COMMIT_LIMITS } from './default-commit-limits';
import { isPositiveInteger } from './is-positive-integer';
import { isRecord } from './values/is-record';

/** A limit that is not a positive integer is read as its default: `config/valid` reports it. */
export function parseCommitLimits(value: unknown): CommitLimits {
  const raw = isRecord(value) ? value : {};

  const limit = (key: keyof CommitLimits): number =>
    isPositiveInteger(raw[key]) ? raw[key] : DEFAULT_COMMIT_LIMITS[key];

  return { maxFiles: limit('maxFiles'), maxLines: limit('maxLines') };
}
