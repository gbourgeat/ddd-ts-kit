import type { FileStorage } from '@ddd-ts-kit/kernel';

export interface VerifyTrailOptions {
  /**
   * Where the archives were written. Given, every archive of each chain is read back, oldest
   * first, and proved by `verifyArchive` against the one before it before the entries left in the
   * trail are verified from the anchor of the last: an archive row without its file, or whose file
   * does not prove it, is the break of its chain, and so is a storage that fails to answer. Left
   * out, an anchor is what its row says.
   */
  readonly files?: FileStorage;
}
