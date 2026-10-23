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
  readonly ref: string;
  readonly rows: readonly string[];
}

/**
 * Checks the design of rows against the code of a ref, before they are built: the names it cites
 * that the history of the ref removed, the places the canonical tree refuses, and the names
 * close to one the ref gained since. Reads git only when the design cites a name.
 */
export function staleNamesAt(root: string, config: Config, asked: RowsAtRef): CitationsAtRef {
  const { ref } = asked;
  const slices = readSlices(new Workspace(root, false)) ?? [];
  const parts = selectParts(rowDocuments(root, slices), { rows: new Set(asked.rows), unlinked: false });
  const citations = citationsOf(citedParts(parts, slices, { root, config }));
  const commit = runGit(root, ['rev-parse', '--short', ref])?.trim() ?? ref;

  if (citations.length === 0) {
    return { base: ref, commit, counts: { present: 0, planned: 0 }, citations: [], notes: [] };
  }

  const index = indexAtRef(root, ref, config.sourceRoot);
  const history = removalsAtRef(root, ref, config.sourceRoot);
  const { stale, counts } = judgedCitations(citations, { root, config, index, history, ref });

  return { base: ref, commit, counts, citations: stale, notes: refNotes(root, ref) };
}
