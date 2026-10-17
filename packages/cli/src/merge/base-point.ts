import type { MergeFinding } from './lost/merge-finding.js';

/**
 * The commit a merge of the trunk is computed from: the newest commit of the branch the trunk
 * already holds, and how it was found. Too old, a merge shows conflicts it need not; too new, it
 * drops lines silently: what is not proven falls back to the older one.
 *
 * - `option`: `--since`;
 * - `landed`: the patch of the branch up to that commit is the patch of one commit of the trunk (a squash);
 * - `recorded`: the commit worker-scope recorded as the base of the worker, its lines on the trunk;
 * - `merge-base`: what git computes.
 */
export interface BasePoint {
  readonly commit: string;
  readonly evidence: 'option' | 'landed' | 'recorded' | 'merge-base';
  /** For `landed`: the commit of the trunk that took the branch in, and the branch (or commit) it took. */
  readonly landedAs?: LandedAs;
  /** Branches sharing commits with this one that were not found on the trunk, each with the `--since` to pass if it landed. */
  readonly unlanded?: readonly Unlanded[];
  /** For a recorded base whose lines are not all on the trunk: those lines, for a person to confirm with `--since`. */
  readonly notOnTrunk?: readonly MergeFinding[];
}

export interface LandedAs {
  /** The commit of the trunk. */
  readonly commit: string;
  readonly subject: string;
  /** The branch whose commit landed, or that commit, abbreviated, when it is on this branch. */
  readonly from: string;
}

interface Unlanded {
  readonly branch: string;
  readonly since: string;
}
