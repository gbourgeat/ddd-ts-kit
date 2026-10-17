import type { MergeFinding } from './merge-finding.js';
import type { MergeToVerify } from './merge-to-verify.js';

/** What `verify-merge` found in one merge. */
export interface MergeCheck extends Omit<MergeToVerify, 'accepted'> {
  /** Lost lines, rows no longer done or gone, lost tests and spec files, lost migrations, conflict markers. */
  readonly errors: readonly MergeFinding[];
  /** Lines brought back, hunks the merge rewrote. */
  readonly warnings: readonly MergeFinding[];
  /** Errors its `Lost-Accepted:` trailer names: a removal someone decided, listed, never failing. */
  readonly accepted: readonly MergeFinding[];
  /** Errors of a merge older than HEAD that HEAD no longer has: a later commit restored them. */
  readonly repaired: readonly MergeFinding[];
}
