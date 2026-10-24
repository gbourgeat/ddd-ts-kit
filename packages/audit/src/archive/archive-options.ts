import type { Clock, FileStorage } from '@ddd-ts-kit/kernel';

/** Where the archives are written, and the clock that dates them. */
export interface ArchiveOptions {
  readonly files: FileStorage;
  readonly clock: Clock;
}
