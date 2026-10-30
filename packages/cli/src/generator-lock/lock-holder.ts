/** What `.ddd-ts-kit/lock/holder.json` says of the command that holds the lock, as far as it could be read. */
export interface LockHolder {
  /** The command line, undefined while the holder has not written its file yet. */
  readonly command?: string;
  readonly pid?: number;
  readonly host?: string;
  /** When the lock was taken, in milliseconds: from the file, else from the folder of the lock. */
  readonly startedAt: number;
}
