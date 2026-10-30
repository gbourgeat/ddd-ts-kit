import type { DerivedTree } from './derived-tree';

/** One kind of file a command of the kit writes from the sources, and how each reader of the kit treats it. */
export interface DerivedFileKind {
  /** How the `## Do not report` of REVIEW.md names it. */
  readonly label: (tree: DerivedTree) => string;
  /** Whether a path, relative to the project root, is of that kind. */
  readonly covers: (path: string, tree: DerivedTree) => boolean;
  /** The same files as git pathspecs, relative to the project root: what a merge compares a patch without. */
  readonly pathspecs: (tree: Pick<DerivedTree, 'contextsDir' | 'platformDir'>) => readonly string[];
  /**
   * Written again whole by `npm run regenerate`, so merged by regenerating it and never by hand
   * (`isDerived`). False for a registry whose lines the merge keeps from both sides (the schema
   * index) and for the pages the merge regenerates apart (the behaviour pages).
   */
  readonly regenerated: boolean;
  /** Set when the kit writes only some sections of such a file, between `ddd-ts-kit:` markers: a change outside them is reviewed. */
  readonly sections?: true;
}
