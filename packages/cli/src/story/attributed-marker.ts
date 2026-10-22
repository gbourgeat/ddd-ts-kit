import type { Remaining } from '../progress/remaining';

/** Runs git in a directory: what it prints, undefined when it fails. */
export type GitRunner = (directory: string, args: readonly string[]) => string | undefined;

/** Which rows a marker belongs to, and how that is known. */
export interface MarkerAttribution {
  /**
   * `text`: it names a row (`#M1.03` or `M1.03`). `commit`: the commit that wrote its line names
   * one, by its `Slice:` trailer or else in its message. `worker`: its line is not committed, in
   * the worktree of a worker, whose rows it takes. `none`: nothing says.
   */
  readonly by: 'text' | 'commit' | 'worker' | 'none';
  /** The ids of the rows it belongs to; empty for `none`. */
  readonly rows: readonly string[];
  /** For `commit`: the abbreviated hash, and whether its `Slice:` trailer named the rows. */
  readonly commit?: { readonly sha: string; readonly trailer: boolean };
}

/** A marker with the rows it belongs to. */
export interface AttributedMarker extends Remaining {
  readonly attribution: MarkerAttribution;
}
