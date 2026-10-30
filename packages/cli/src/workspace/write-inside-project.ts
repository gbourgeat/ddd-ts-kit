import path from 'node:path';
import { refuseLeaving } from './refuse-leaving';
import { writeIfAllowed } from './write-if-allowed';

/**
 * Writes one state or scope file of a command, whole or not at all, and only inside the project: a
 * symbolic link in its place or above it that leads out of `root` refuses the command, the path
 * named, before anything is written.
 */
export function writeInsideProject(root: string, file: string, content: string): void {
  const absolute = path.resolve(root, file);
  const real = refuseLeaving(root, [file], () => absolute).get(file);

  writeIfAllowed(absolute, content, { real });
}
