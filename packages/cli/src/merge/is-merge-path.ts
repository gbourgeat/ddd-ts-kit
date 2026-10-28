import { ADR_DIRECTORY } from '../check/governance/adr-directory';
import { STORED_EVENTS_LOCK } from '../check/event-sourcing/stored-events-lock-file';
import { isDerivedInMerge } from './is-derived-in-merge';
import { SLICES_FILE } from '../progress/read-slices';
import type { MergeRepository } from './lost/merge-repository';

const LOCKFILES = new Set(['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock']);

/** Whether the merge may commit `file` (relative to the repository top): a derived file, a migration, a decision record, a lockfile, the slices file or the stored-events lock. */
export function isMergePath(file: string, repo: MergeRepository): boolean {
  const { prefix } = repo;
  const inProject = file.startsWith(prefix) ? file.slice(prefix.length) : undefined;

  return (
    inProject !== undefined &&
    (isDerivedInMerge(inProject, repo) ||
      /(?:^|\/)migrations\//.test(inProject) ||
      inProject.startsWith(`${ADR_DIRECTORY}/`) ||
      LOCKFILES.has(inProject.split('/').at(-1) ?? '') ||
      inProject === SLICES_FILE ||
      inProject === STORED_EVENTS_LOCK)
  );
}
