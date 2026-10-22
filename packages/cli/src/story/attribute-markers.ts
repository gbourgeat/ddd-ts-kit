import path from 'node:path';
import { mentionedRows } from '../citations/mentioned-rows';
import { WORKER_SCOPE_FILE } from '../commit/worker-scope-file';
import type { Remaining } from '../progress/remaining';
import { readWorkerFile } from '../worker/read-worker-file';
import { blamedLines } from './blamed-lines';
import { type CommitRows, commitRows } from './commit-rows';
import type { AttributedMarker, GitRunner, MarkerAttribution } from './attributed-marker';

const NONE: MarkerAttribution = { by: 'none', rows: [] };

/**
 * The rows each marker belongs to: those its text names; else those the commit that wrote its
 * line names (its `Slice:` trailer, else its message), read with one `git blame` per file and one
 * git call for the commits; else, for a line not committed, the rows of the worker whose worktree
 * holds the project (`.ddd-ts-kit/worker.json`). `ids` are the ids of every row of the slices file.
 */
export function attributeMarkers(
  root: string,
  markers: readonly Remaining[],
  around: { readonly ids: readonly string[]; readonly git: GitRunner },
): AttributedMarker[] {
  const named = markers.map((marker) => ({ marker, rows: mentionedRows(marker.text, around.ids) }));

  const blamed = blamedLines(
    root,
    named.filter(({ rows }) => rows.length === 0).map(({ marker }) => marker),
    around.git,
  );

  const shas = [...new Set(blamed.values())].filter((sha) => sha !== '');
  const lines = { blamed, commits: commitRows(root, shas, around), worker: workerRows(root, around.ids) };

  return named.map(({ marker, rows }) => ({
    ...marker,
    attribution: rows.length > 0 ? { by: 'text', rows } : fromLine(lines, `${marker.file}:${marker.line}`),
  }));
}

interface Lines {
  readonly blamed: ReadonlyMap<string, string>;
  readonly commits: ReadonlyMap<string, CommitRows>;
  readonly worker: readonly string[];
}

function fromLine({ blamed, commits, worker }: Lines, at: string): MarkerAttribution {
  const sha = blamed.get(at);

  if (sha === '') {
    return worker.length === 0 ? NONE : { by: 'worker', rows: worker };
  }

  const commit = sha === undefined ? undefined : commits.get(sha);

  return sha === undefined || commit === undefined
    ? NONE
    : { by: 'commit', rows: commit.rows, commit: { sha: sha.slice(0, 7), trailer: commit.trailer } };
}

/** The rows of the worker whose worktree holds the project, those the slices file has; none outside a worker. */
function workerRows(root: string, ids: readonly string[]): string[] {
  return (readWorkerFile(path.join(root, WORKER_SCOPE_FILE))?.rows ?? []).filter((id) => ids.includes(id));
}
