import type { History, Removal } from './history.js';
import { linesOf } from './lines-of.js';

/** The header `--format=@%h%x09%cs%x09%ct%x09%s` writes before the files of a commit. */
const HEADER = /^@([^\t]+)\t([^\t]*)\t(\d+)\t(.*)$/;

interface Writable {
  readonly removals: Map<string, Removal>;
  readonly added: Map<string, number>;
}

interface Change {
  readonly commit?: string;
  readonly date: string;
  readonly subject: string;
  readonly time: number;
  readonly entries: (readonly string[])[];
}

/**
 * What a `--name-status` listing says was removed and added, the most recent first: each commit
 * of `git log` under its header, or the files of `git diff` without one, a change not committed
 * yet whose files still exist at `workingBase`.
 */
export function historyOf(output: string, workingBase: string): History {
  const history = { removals: new Map<string, Removal>(), added: new Map<string, number>() };

  for (const change of changesOf(output)) {
    recorded(change, workingBase, history);
  }

  return history;
}

/** Records what one change removed and added, unless a more recent change already did for the same path. */
function recorded(change: Change, workingBase: string, history: Writable): void {
  const addedWith = change.entries.flatMap(([status = '', from = '', to]) =>
    status.startsWith('A') ? [from] : status.startsWith('R') && to !== undefined ? [to] : [],
  );

  for (const [status = '', from = '', to] of change.entries) {
    const renamed = to === undefined ? {} : { to };

    if (status.startsWith('D') || status.startsWith('R')) {
      once(history.removals, from, removalOf(change, { path: from, addedWith, workingBase, ...renamed }));
    }

    if (status.startsWith('A') || status.startsWith('R')) {
      once(history.added, to ?? from, change.time);
    }
  }
}

function changesOf(output: string): Change[] {
  const changes: Change[] = [{ date: '', subject: '', time: Date.now() / 1000, entries: [] }];

  for (const line of linesOf(output)) {
    const [, commit, date = '', time = '0', subject = ''] = HEADER.exec(line) ?? [];

    if (commit !== undefined) {
      changes.push({ commit, date, subject, time: Number(time), entries: [] });
    } else {
      changes.at(-1)?.entries.push(line.split('\t'));
    }
  }

  return changes;
}

interface Removed {
  readonly path: string;
  readonly to?: string;
  readonly addedWith: readonly string[];
  readonly workingBase: string;
}

function removalOf(change: Change, removed: Removed): Removal {
  const { commit, date, subject } = change;
  const { path, to, addedWith, workingBase } = removed;
  const committed = commit === undefined ? {} : { commit, date, subject };

  return {
    path,
    before: commit === undefined ? workingBase : `${commit}^`,
    ...committed,
    ...(to === undefined ? {} : { renamedTo: to }),
    addedWith,
  };
}

function once<T>(map: Map<string, T>, key: string, value: T): void {
  if (!map.has(key)) {
    map.set(key, value);
  }
}
