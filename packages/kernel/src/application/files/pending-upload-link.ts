import type { PendingUpload } from './pending-upload.js';
import type { SignedUpload } from './signed-upload.js';

/** What `FileStaging.uploadUrl` answers: the request for the client, and the grant for the server to keep. */
export interface PendingUploadLink {
  /** Handed to the client. */
  readonly link: SignedUpload;
  /** Kept on the server, on the aggregate that awaits the file; never handed to the client to send back. */
  readonly pending: PendingUpload;
}
