import { isDerived } from '../../derived/is-derived.js';
import { SLICES_FILE } from '../../progress/read-slices.js';
import type { MergeRepository } from './merge-repository.js';

const LOCKFILES = new Set([
  'package-lock.json',
  'npm-shrinkwrap.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lock',
  'bun.lockb',
  'uv.lock',
  'poetry.lock',
  'Pipfile.lock',
  'Cargo.lock',
  'Gemfile.lock',
  'composer.lock',
  'go.sum',
  'packages.lock.json',
]);

/**
 * Whether the lines of a path are compared. Left out: the kit's working files, the derived files
 * (a merge takes either side and regenerates them), the migrations (checked by description), the
 * lockfiles and the slices file (checked by rows).
 */
export function isLineChecked(file: string, { prefix, contextsDir }: MergeRepository): boolean {
  const inProject = file.startsWith(prefix) ? file.slice(prefix.length) : undefined;
  const name = file.split('/').at(-1) ?? file;

  return !(
    /(?:^|\/)\.ddd-ts-kit\//.test(file) ||
    /(?:^|\/)migrations\//.test(file) ||
    LOCKFILES.has(name) ||
    (inProject !== undefined && (inProject === SLICES_FILE || isDerived(inProject, { contextsDir })))
  );
}
