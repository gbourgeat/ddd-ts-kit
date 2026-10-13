import type { SignedLinkOptions } from './signed-link-options.js';

export interface LocalFileStorageOptions extends SignedLinkOptions {
  /** The directory that holds the files, created when missing. Keep it out of version control. */
  readonly directory: string;
}
