import type { MergeFinding } from './merge-finding';

/** The kinds that say a side's content is missing from the result: the others point at the result or at a removal. */
const MISSING: ReadonlySet<MergeFinding['kind']> = new Set([
  'lost-line',
  'superseded',
  'rewritten',
  'test-lost',
  'spec-deleted',
]);

/**
 * Drops what the branch cannot have lost: a finding on a line of the branch in a file that is the
 * same on the branch and at the fork (where the branch left the trunk, or last took it in). The
 * branch did not touch that file, so what the trunk removed or replaced there since is the
 * trunk's change, even when the base the merge is computed from is older than the fork.
 */
export function untouchedByBranch(
  findings: readonly MergeFinding[],
  files: { readonly ours: ReadonlyMap<string, string>; readonly fork: ReadonlyMap<string, string> },
): MergeFinding[] {
  return findings.filter(
    (finding) => !(MISSING.has(finding.kind) && finding.side === 'ours' && isUntouched(finding, files)),
  );
}

function isUntouched(
  { file }: MergeFinding,
  { ours, fork }: { readonly ours: ReadonlyMap<string, string>; readonly fork: ReadonlyMap<string, string> },
): boolean {
  const kept = ours.get(file);

  return kept !== undefined && kept === fork.get(file);
}
