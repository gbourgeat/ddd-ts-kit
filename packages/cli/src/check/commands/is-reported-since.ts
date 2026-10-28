import type { Violation } from '../model/violation';

/**
 * Whether `check --changed-since` reports a violation: the file it sits on changed, or one of the
 * files it names as its subjects (where it is repaired) did. Without a set of changed files,
 * every violation is reported.
 */
export function isReportedSince(violation: Violation, changed: ReadonlySet<string> | undefined): boolean {
  return (
    changed === undefined || changed.has(violation.file) || (violation.subjects ?? []).some((path) => changed.has(path))
  );
}
