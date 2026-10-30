import path from 'node:path';
import { BLOCKED, type RealPath } from './real-path-of';

/** Where a path of the project would land out of it, every symbolic link on the way followed. */
export interface Leaving {
  readonly to: string;
}

/**
 * Whether writing `absolute`, whose real path is `real` (`realPathOf`), would land out of the
 * project whose real root is `project` (`realRootOf`, resolved once for a plan): the real path of the target, a symbolic link in its
 * place or above it followed to where it points, is not under it. A link that stays inside is
 * written through. A device where a folder or a file goes, what a sandbox mounts over a path it
 * protects, is no way out: the write fails there and is reported unwritable.
 */
export function leavingProject(project: string | undefined, absolute: string, real: RealPath): Leaving | undefined {
  if (real === BLOCKED) {
    return undefined;
  }

  const inside = real === undefined || project === undefined ? '..' : path.relative(project, real);

  return inside.startsWith('..') || path.isAbsolute(inside) ? { to: real ?? absolute } : undefined;
}
