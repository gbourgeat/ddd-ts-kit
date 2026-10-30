import path from 'node:path';

/**
 * The path of `segments` under `root`, refused when it lands anywhere else. A valid key cannot
 * climb out; this holds the promise even if the key rules change one day.
 */
export function resolvedInside(root: string, segments: readonly string[]): string {
  const resolved = path.resolve(root, ...segments);

  if (!resolved.startsWith(root + path.sep)) {
    throw new Error('A file key resolved outside the directory of the storage.');
  }

  return resolved;
}
