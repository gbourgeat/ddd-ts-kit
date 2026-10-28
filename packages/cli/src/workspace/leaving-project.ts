import fs from 'node:fs';
import path from 'node:path';

/** A folder above the target that is no folder: the write fails there, and is reported unwritable. */
const BLOCKED = Symbol('blocked');

/** How a path of the project would lead out of it: a symbolic link in its place, or a folder above it that is elsewhere. */
export type Leaving = { readonly kind: 'link' } | { readonly kind: 'outside'; readonly to: string };

/**
 * Whether writing `absolute` would land out of the project at `root`: the target is a symbolic
 * link to a file or a folder, or the real path of its deepest existing part (every link above it
 * followed) is not under the real path of the root. A device where a folder or a file goes, what
 * a sandbox mounts over a path it protects, is no way out: the write fails there and is reported
 * unwritable.
 */
export function leavingProject(root: string, absolute: string): Leaving | undefined {
  if (isLinkOut(absolute)) {
    return { kind: 'link' };
  }

  const real = realPathOf(absolute);
  const project = realPathOf(root);

  if (real === BLOCKED) {
    return undefined;
  }

  const inside = real === undefined || typeof project !== 'string' ? '..' : path.relative(project, real);

  return inside.startsWith('..') || path.isAbsolute(inside) ? { kind: 'outside', to: real ?? absolute } : undefined;
}

function isLinkOut(absolute: string): boolean {
  if (lstatOf(absolute)?.isSymbolicLink() !== true) {
    return false;
  }

  try {
    const target = fs.statSync(absolute);

    return target.isFile() || target.isDirectory();
  } catch {
    // A link to nothing: the write would create its target, wherever it points.
    return true;
  }
}

/**
 * The real path of the deepest part of `absolute` that exists, the parts below it appended as
 * they are; `BLOCKED` when that part is a folder above the target and no folder; undefined when
 * a link on the way leads to nothing.
 */
function realPathOf(absolute: string): string | typeof BLOCKED | undefined {
  const missing: string[] = [];
  let at = path.resolve(absolute);

  while (lstatOf(at) === undefined && path.dirname(at) !== at) {
    missing.unshift(path.basename(at));
    at = path.dirname(at);
  }

  try {
    const real = fs.realpathSync(at);

    return missing.length > 0 && !fs.statSync(real).isDirectory() ? BLOCKED : path.join(real, ...missing);
  } catch {
    return undefined;
  }
}

function lstatOf(absolute: string): fs.Stats | undefined {
  try {
    return fs.lstatSync(absolute);
  } catch {
    return undefined;
  }
}
