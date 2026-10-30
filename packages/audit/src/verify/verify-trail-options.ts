import type { FileStorage } from '@ddd-ts-kit/kernel';

export interface VerifyTrailOptions {
  /**
   * Where the archives were written. Given, the last archive of each chain is read back and proved
   * by `verifyArchive` before the entries left in the trail are verified from its anchor: an archive
   * row without its file, or whose file does not prove it, is the break of its chain. Left out, the
   * anchor is what the row says.
   */
  readonly files?: FileStorage;
}
