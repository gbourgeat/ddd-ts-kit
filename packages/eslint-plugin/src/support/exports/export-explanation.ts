/**
 * Why the exports of a module are one thing. `mains` are the names the file may be named
 * after; `free` is a family that no single export names (the accessors of one state, the
 * combinators of an imported type).
 */
export interface ExportExplanation {
  readonly mains: readonly string[] | 'free';
}
