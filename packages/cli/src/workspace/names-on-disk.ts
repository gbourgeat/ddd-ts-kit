import fs from 'node:fs';

/** The names of the entries of a folder on disk that `wanted` keeps; none for a folder that does not exist yet. */
export function namesOnDisk(directory: string, wanted: (entry: fs.Dirent) => boolean): string[] {
  try {
    return fs
      .readdirSync(directory, { withFileTypes: true })
      .filter(wanted)
      .map((entry) => entry.name);
  } catch {
    // A directory that does not exist yet simply holds nothing on disk.
    return [];
  }
}
