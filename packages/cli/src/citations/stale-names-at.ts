import { commitOf } from '../commit/commit-of';
import { runGit } from '../commit/run-git';
import type { Config } from '../config';
import { readSlices } from '../progress/read-slices';
import { Workspace } from '../workspace';
import { citationsOf } from './citations-of';
import { citedParts } from './cited-parts';
import { indexAtRef } from './index-at-ref';
import { judgedCitations } from './judged-citations';
import { refNotes } from './ref-notes';
import { removalsAtRef } from './removals-at-ref';
import { rowDocuments } from './row-documents';
import { selectParts } from './select-parts';
import type { StaleCitation } from './stale-citation';

/** The names the design of some rows cites that a ref does not have: what `cited` and `worker-scope` report. */
export interface CitationsAtRef {
  readonly base: string;
  /** The commit the ref named, abbreviated. */
  readonly commit: string;
  readonly counts: { readonly present: number; readonly planned: number };
  readonly citations: readonly StaleCitation[];
  readonly notes: readonly string[];
}

/** The rows whose design is checked, and the ref it is checked against. */
export interface RowsAtRef {
  /** The ref by its name, which the report prints. */
  readonly ref: string;
  /** The commit it names, which git is given: resolved here when the caller has not. */
  readonly commit?: string;
  readonly rows: readonly string[];
}

/**
 * Checks the design of rows against the code of a ref, before they are built: the names it cites
 * that the history of the ref removed, the places the canonical tree refuses, and the names
 * close to one the ref gained since. Reads git only when the design cites a name, and gives it the
 * commit, never the name, which may start with a dash; a ref that names no commit is judged
 * against nothing, and said.
 */
export function staleNamesAt(root: string, config: Config, asked: RowsAtRef): CitationsAtRef {
  const { ref } = asked;
  const slices = readSlices(new Workspace(root, false)) ?? [];
  const parts = selectParts(rowDocuments(root, slices), { rows: new Set(asked.rows), unlinked: false });
  const citations = citationsOf(citedParts(parts, slices, { root, config }));
  const full = asked.commit ?? commitOf(root, ref);
  const commit = full === undefined ? ref : (runGit(root, ['rev-parse', '--short', full])?.trim() ?? full);
  const none = { base: ref, commit, counts: { present: 0, planned: 0 }, citations: [] };

  if (full === undefined) {
    return { ...none, notes: [`${ref} is not a commit of this repository: the design was not checked against it.`] };
  }

  if (citations.length === 0) {
    return { ...none, notes: [] };
  }

  const index = indexAtRef(root, full, config.sourceRoot);
  const history = removalsAtRef(root, full, config.sourceRoot);
  const { stale, counts } = judgedCitations(citations, { root, config, index, history, ref: full });

  return { base: ref, commit, counts, citations: stale, notes: refNotes(root, ref) };
}
