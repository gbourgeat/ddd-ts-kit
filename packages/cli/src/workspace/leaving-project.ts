import fs from 'node:fs';
import path from 'node:path';

/** A folder above the target, or the target of a link, that is no folder nor file: the write fails there, and is reported unwritable. */
const BLOCKED = Symbol('blocked');

/** Where a path of the project would land out of it, every symbolic link on the way followed. */
export interface Leaving {
  readonly to: string;
}

/**
 * Whether writing `absolute` would land out of the project at `root`: the real path of the target,
 * a symbolic link in its place or above it followed to where it points, is not under the real path
 * of the root. A link that stays inside is written through. A device where a folder or a file
 * goes, what a sandbox mounts over a path it protects, is no way out: the write fails there and is
 * reported unwritable.
 */
export function leavingProject(root: string, absolute: string): Leaving | undefined {
  const real = realPathOf(absolute);
  const project = realPathOf(root);

  if (real === BLOCKED) {
    return undefined;
  }

  const inside = real === undefined || typeof project !== 'string' ? '..' : path.relative(project, real);

  return inside.startsWith('..') || path.isAbsolute(inside) ? { to: real ?? absolute } : undefined;
}

/**
 * The real path `absolute` is written at: a link in its place followed to where it points, then
 * the real path of the deepest part that exists, the parts below it appended as they are;
 * `BLOCKED` when what stands there is no folder above the target, or no file nor folder at the
 * end of a link; undefined when a link on the way cannot be read.
 */
function realPathOf(absolute: string, hops = 0): string | typeof BLOCKED | undefined {
  const at = path.resolve(absolute);

  if (lstatOf(at)?.isSymbolicLink() === true) {
    return hops > 32 ? undefined : linkedPathOf(at, hops);
  }

  return existingRealPathOf(at);
}

function linkedPathOf(at: string, hops: number): string | typeof BLOCKED | undefined {
  try {
    const target = fs.statSync(at);

    if (!target.isFile() && !target.isDirectory()) {
      return BLOCKED;
    }

    return fs.realpathSync(at);
  } catch {
    // A link to nothing: the write creates its target, wherever it points.
    try {
      return realPathOf(path.resolve(path.dirname(at), fs.readlinkSync(at)), hops + 1);
    } catch {
      return undefined;
    }
  }
}

function existingRealPathOf(absolute: string): string | typeof BLOCKED | undefined {
  const missing: string[] = [];
  let at = absolute;

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
