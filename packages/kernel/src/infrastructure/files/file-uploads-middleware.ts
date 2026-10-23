import { FileUpload } from '../../application/files/file-upload';
import type { BusMiddleware } from '../../application/messaging/bus-middleware';
import type { Message } from '../../application/messaging/message';
import type { UploadDesk } from './upload-desk';

/**
 * Stages the `FileUpload` fields of a command, each under a new key of its area, scanned, then
 * hands over to the next middleware. Installed after the permission check, so a refused actor
 * stores nothing, and before the unit of work (and the audit entry that opens it), so that no
 * transaction waits while a client uploads. `desk` is resolved only for a command that carries
 * a file: building the bus opens nothing.
 */
export function fileUploadsMiddleware(desk: () => UploadDesk): BusMiddleware {
  return async (message, next, info) => {
    const uploads = info.kind === 'command' ? waitingUploadsOf(message) : [];

    if (uploads.length > 0) {
      const { keys, staging } = desk();

      for (const upload of uploads) {
        const { stream, mediaType } = upload.received;

        upload.stagedAs(await staging.stage(keys.next(upload.area), stream, { mediaType }));
      }
    }

    return next();
  };
}

function waitingUploadsOf(message: Message): FileUpload[] {
  return Object.values(message).filter((value): value is FileUpload => value instanceof FileUpload && !value.isStaged);
}
