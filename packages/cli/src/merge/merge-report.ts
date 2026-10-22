import type { BasePoint } from './base-point';
import type { MergeFinding } from './lost/merge-finding';
import type { Resolution } from './resolution';

/**
 * What `merge-trunk` did or would do, as its text and `--json` report it:
 * - `up-to-date`: the branch already holds the trunk;
 * - `dry-run`: the preview, nothing changed;
 * - `stopped`: something is left to a person, the merge stays in progress (or, before it starts, nothing changed);
 * - `committed`: the merge commit is made.
 */
export interface MergeReport {
  readonly status: 'up-to-date' | 'dry-run' | 'stopped' | 'committed';
  readonly branch: string;
  readonly trunk: { readonly ref: string; readonly commit: string };
  readonly base: BasePoint;
  readonly conflicts: ConflictCounts;
  /** What was settled without a person: conflicted paths by their class, decision records renumbered. */
  readonly automatic: readonly Settled[];
  readonly forYou: readonly ForYou[];
  /** What happened to the migrations: replayed, renamed, or why the merge stopped on them. */
  readonly migrations: readonly string[];
  readonly regenerate: StepRun;
  /** The lines, rows and tests the result lost, as verify-merge reads them; null before that step. */
  readonly lostLines: LostLines | null;
  /** Changed paths that are not the merge's: they block its commit. */
  readonly leftOut: readonly string[];
  /** Why it stopped. */
  readonly stop?: string;
  /** The merge commit, once made. */
  readonly commit?: string;
  readonly next: string;
}

interface ConflictCounts {
  /** The files a plain `git merge` of the trunk would leave conflicted. */
  readonly plainMerge: number;
  /** The files left conflicted by the merge computed from the base: the branch's own diff against the trunk. */
  readonly ownDiff: number;
  readonly automatic: number;
  readonly forYou: number;
}

export interface Settled {
  readonly file: string;
  readonly kind: Resolution['kind'] | 'adr';
  readonly how: string;
}

/** A conflicted path left to a person, with what each side did to it. */
export interface ForYou {
  readonly file: string;
  readonly kind: Resolution['kind'];
  readonly why: string;
  /** The lines of each conflict left in the file, `from-to`. */
  readonly hunks: readonly string[];
  /** The branch, the rows briefed to its worker, and what it did in the conflicts. */
  readonly ours: { readonly branch: string; readonly rows: readonly string[]; readonly change: string };
  /** The trunk, the commits that touched the file since the base, and what they did in the conflicts. */
  readonly theirs: { readonly ref: string; readonly commits: readonly string[]; readonly change: string };
  readonly advice: string;
}

export interface StepRun {
  readonly status: 'ok' | 'failed' | 'skipped' | 'pending';
  /** Why it was skipped, or the end of what it printed when it failed. */
  readonly output?: string;
}

export interface LostLines {
  readonly errors: readonly MergeFinding[];
  readonly warnings: readonly MergeFinding[];
  readonly accepted: readonly MergeFinding[];
}
