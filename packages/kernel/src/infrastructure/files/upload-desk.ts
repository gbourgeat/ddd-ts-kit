import type { FileKeys } from '../../application/ports/file-keys.js';
import type { FileStaging } from './file-staging.js';

/** What `fileUploadsMiddleware` stages a file upload with: the keys of the server and the staging. */
export interface UploadDesk {
  readonly keys: FileKeys;
  readonly staging: FileStaging;
}
