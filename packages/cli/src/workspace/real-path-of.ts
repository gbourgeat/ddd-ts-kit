import fs from 'node:fs';
import path from 'node:path';

/** A folder above the target, or the target of a link, that is no folder nor file: the write fails there, and is reported unwritable. */
export const BLOCKED = Symbol('blocked');

/** What `realPathOf` answers: the real path, `BLOCKED`, or undefined when a link on the way cannot be read. */
export type RealPath = string | typeof BLOCKED | undefined;

/**
 * The real path `absolute` is written at: a link in its place followed to where it points, then
 * the real path of the deepest part that exists, the parts below it appended as they are;
 * `BLOCKED` when what stands there is no folder above the target, or no file nor folder at the
 * end of a link; undefined when a link on the way cannot be read.
 */
export function realPathOf(absolute: string, hops = 0): RealPath {
  const at = path.resolve(absolute);
  const link = linkAt(at);

  if (link !== undefined) {
    return hops > 32 ? undefined : linkedPathOf(at, link, hops);
  }

  return existingRealPathOf(at);
}

/** Where the link at `absolute` points; undefined when what stands there is no link. */
function linkAt(absolute: string): string | undefined {
  try {
    return fs.readlinkSync(absolute);
  } catch {
    return undefined;
  }
}

function linkedPathOf(at: string, link: string, hops: number): RealPath {
  try {
    const target = fs.statSync(at);

    if (!target.isFile() && !target.isDirectory()) {
      return BLOCKED;
    }

    return fs.realpathSync(at);
  } catch {
    // A link to nothing: the write creates its target, wherever it points.
    return realPathOf(path.resolve(path.dirname(at), link), hops + 1);
  }
}

function existingRealPathOf(absolute: string): RealPath {
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
