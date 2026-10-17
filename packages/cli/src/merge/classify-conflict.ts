import { STORED_EVENTS_LOCK } from '../check/event-sourcing/stored-events-lock-file.js';
import { isDerived } from '../derived/is-derived.js';
import { SLICES_FILE } from '../progress/read-slices.js';
import type { MergeRepository } from './lost/merge-repository.js';

/**
 * How a conflicted path is settled:
 * - `derived`: written again by `regenerate`, the trunk's side is taken;
 * - `mixed`: a document whose generated regions take the trunk's side, the rest is a person's;
 * - `slices`: the slices file, merged row by row;
 * - `drizzle-meta`: the journal and snapshots of drizzle-kit, the trunk's side, then the replay;
 * - `lockfile`: the trunk's side, then an install when the branch changed package.json;
 * - `stored-events`: the stored-events lock, the union of both sides;
 * - `source`: anything else, settled by a person except the conflicts inside generated registries.
 */
export type ConflictClass = 'derived' | 'mixed' | 'slices' | 'drizzle-meta' | 'lockfile' | 'stored-events' | 'source';

const LOCKFILES = new Set(['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock']);
const DRIZZLE_META = /(?:^|\/)meta\/(?:_journal|\d+_snapshot)\.json$/;

/** The class of a conflicted path, from the top of the repository. */
export function classifyConflict(file: string, { prefix, contextsDir }: MergeRepository): ConflictClass {
  const inProject = file.startsWith(prefix) ? file.slice(prefix.length) : undefined;
  const name = file.split('/').at(-1) ?? file;

  if (inProject === undefined) {
    return 'source';
  }

  if (inProject === SLICES_FILE) {
    return 'slices';
  }

  if (inProject === 'docs/context-map.md' || (inProject.startsWith(`${contextsDir}/`) && name === 'CONTEXT.md')) {
    return 'mixed';
  }

  if (isDerived(inProject, { contextsDir })) {
    return 'derived';
  }

  return otherClass(inProject, name);
}

function otherClass(inProject: string, name: string): ConflictClass {
  if (DRIZZLE_META.test(inProject)) {
    return 'drizzle-meta';
  }

  if (LOCKFILES.has(name)) {
    return 'lockfile';
  }

  return inProject === STORED_EVENTS_LOCK ? 'stored-events' : 'source';
}
