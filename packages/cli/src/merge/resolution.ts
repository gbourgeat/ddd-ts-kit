import type { ConflictClass } from './classify-conflict';
import type { ConflictBlock } from './conflict-blocks';

/** How one conflicted path was settled, or what of it is left to a person. */
export interface Resolution {
  readonly file: string;
  /** Its class; `registry` for a source whose conflicts all lay in generated registries. */
  readonly kind: ConflictClass | 'registry';
  /**
   * What the working tree gets: the settled content, null to delete the file. For a path left to
   * a person, the merge's text with the conflicts that could be settled, or undefined to leave it.
   */
  readonly content: string | null | undefined;
  readonly settled: boolean;
  /** For a settled path, how; for one left to a person, why. */
  readonly how: string;
  /** The conflicts left, with their lines in `content` (or in the merge's text). */
  readonly blocks: readonly ConflictBlock[];
}
