/**
 * What the writer of a command asks of the disk to put a file in place: the content written to a
 * temporary file, then the file renamed into place. `node:fs` in a command; a spec gives one that
 * fails in the middle of a file, the way a process killed there would.
 */
export interface DiskWrites {
  writeFileSync(file: string, content: string): void;
  renameSync(from: string, to: string): void;
}
