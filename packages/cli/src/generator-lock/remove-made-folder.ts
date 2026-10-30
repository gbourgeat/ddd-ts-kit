import fs from 'node:fs';

/** The kit folder, when the attempt made it and nothing else stands in it. */
export function removeMadeFolder(folder: string, made: boolean): void {
  if (!made) {
    return;
  }

  try {
    fs.rmdirSync(folder);
  } catch {
    // Not empty: another command holds the lock now, or the kit keeps other files there.
  }
}
