import type { FileContent } from './file-content.js';

/** A download a signed link granted: the file, and the name to offer the browser when one was signed. */
export interface SignedDownload extends FileContent {
  readonly fileName?: string;
}
