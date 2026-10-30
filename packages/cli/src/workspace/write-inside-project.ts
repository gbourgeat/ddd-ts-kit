import path from 'node:path';
import { CliError } from '../cli-error';
import type { RealPath } from './real-path-of';
import { refuseLeaving } from './refuse-leaving';
import { writeIfAllowed } from './write-if-allowed';

/**
 * Writes one state or scope file of a command, whole or not at all, and only inside the project: a
 * symbolic link in its place or above it that leads out of `root` refuses the command, the path
 * named, before anything is written.
 */
export function writeInsideProject(root: string, file: string, content: string, real?: RealPath): void {
  const absolute = path.resolve(root, file);
  const where = real ?? refuseLeaving(root, [file], () => absolute).get(file);

  if (!writeIfAllowed(absolute, content, { real: where })) {
    throw new CliError(
      `${file} could not be written: it is read-only, denied to this process, or a folder or a device stands in its place.`,
      `Make ${file} a file this process may write (or remove what stands there), then run again.`,
    );
  }
}
