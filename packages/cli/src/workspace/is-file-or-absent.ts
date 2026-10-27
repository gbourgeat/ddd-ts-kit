import fs from 'node:fs';

/** False for what stands at the path without being a file: a folder, or a device a sandbox mounts over a path it protects. */
export function isFileOrAbsent(absolute: string): boolean {
  try {
    return fs.statSync(absolute).isFile();
  } catch {
    return true;
  }
}
