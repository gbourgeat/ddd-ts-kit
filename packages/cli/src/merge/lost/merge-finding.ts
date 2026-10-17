/**
 * One thing a merge lost or brought back. `file:line` points at the side that holds it: the
 * side that added a lost line, the result for a conflict marker.
 *
 * - `lost-line`: a line one side added or both kept, missing from the result;
 * - `row-not-done`, `row-lost`: a row of the slices file done on one side and not in the result, or gone;
 * - `test-lost`, `spec-deleted`: the title of a test, or a whole spec file, of one side missing from the result;
 * - `file-deleted`: a file neither side deleted, gone from the result with lines no other file has;
 * - `migration-lost`: a migration of one side whose description no migration of the result has;
 * - `conflict-marker`: a line of a conflict marker left in a changed file;
 * - `revived` (warning): a line one side removed, back in the result;
 * - `rewritten` (warning): a line both sides lost in a file the merge wrote lines of its own in;
 * - `superseded` (warning): a line one side wrote in place of base lines the other side changed
 *   too, or in a file the other side deleted: the merge chose between them.
 */
export interface MergeFinding {
  readonly kind:
    | 'lost-line'
    | 'row-not-done'
    | 'row-lost'
    | 'test-lost'
    | 'spec-deleted'
    | 'file-deleted'
    | 'migration-lost'
    | 'conflict-marker'
    | 'revived'
    | 'rewritten'
    | 'superseded';
  readonly file: string;
  readonly line: number;
  /**
   * The side that added it, `both` when both kept it, `result` for what the merge wrote; for a
   * line brought back, the side that removed it.
   */
  readonly side: 'ours' | 'theirs' | 'both' | 'result';
  readonly text: string;
}
