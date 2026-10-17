import path from 'node:path';
import { splitWords } from '../naming/split-words.js';
import type { Evidence } from './evidence.js';
import type { Removal } from './history.js';
import { namesOfFile } from './names-of-file.js';
import { sameStemNames } from './same-stem-names.js';
import type { Candidate } from './stale-citation.js';
import { isTestFile } from './is-test-file.js';

/** A removed name, the removal that gave it, and the contexts its successors are looked for in. */
export interface Removed {
  readonly cited: string;
  readonly removal: Removal;
  readonly contexts: readonly string[];
}

const MOST = 3;

/**
 * The names that may have taken the place of a removed one, by evidence: the file it was
 * renamed to, a file the same commit added in the same context whose name holds the words of
 * the removed one (all but one when it has three or more), then a name with its stem. At most three.
 */
export function candidatesOf(removed: Removed, evidence: Evidence): Candidate[] {
  const all = [
    ...renamed(removed, evidence),
    ...addedWithRemoval(removed, evidence),
    ...sameStemNames(removed.cited, removed.contexts, evidence),
  ];

  return all
    .filter(
      (candidate, index) =>
        all.findIndex((other) => other.name === candidate.name || other.file === candidate.file) === index,
    )
    .slice(0, MOST);
}

function renamed({ cited, removal }: Removed, { index }: Evidence): Candidate[] {
  const to = removal.renamedTo;

  if (to === undefined || !index.files.has(to)) {
    return [];
  }

  const position = Math.max(0, namesOfFile(removal.path).indexOf(cited));
  const after = namesOfFile(to);

  return [{ name: after[position] ?? after[0] ?? path.posix.basename(to), file: to, evidence: 'renamed' }];
}

function addedWithRemoval({ removal }: Removed, { index, config }: Evidence): Candidate[] {
  const [stem = ''] = namesOfFile(removal.path);
  const words = splitWords(stem);
  const home = homeOf(removal.path, config.contextsDir);

  return removal.addedWith.flatMap((file): Candidate[] => {
    const [name] = namesOfFile(file);
    const missing = words.filter((word) => !splitWords(name ?? '').includes(word)).length;
    const kin = name !== undefined && missing <= (words.length >= 3 ? 1 : 0);
    const placed = file.startsWith(`${home}/`) && index.files.has(file) && !isTestFile(file);

    return kin && placed && file !== removal.renamedTo ? [{ name, file, evidence: 'added-with-removal' }] : [];
  });
}

/** The directory of the context of a file, or its own directory outside the contexts. */
function homeOf(file: string, contextsDir: string): string {
  if (!file.startsWith(`${contextsDir}/`)) {
    return path.posix.dirname(file);
  }

  const [context = ''] = file.slice(contextsDir.length + 1).split('/');

  return `${contextsDir}/${context}`;
}
