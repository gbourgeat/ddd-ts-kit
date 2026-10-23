import type { UploadReader } from '../pipeline/upload-reader';
import type { MultipartLimits } from './multipart-limits';
import { readMultipart } from './read-multipart';

/**
 * The upload reader of the kit, on busboy: pass it as `uploads` to the mount options. The file
 * streams to the handler while the request arrives, never held whole.
 */
export function multipartUploads(limits: MultipartLimits = {}): UploadReader {
  return (spec, request) => readMultipart(spec, request, limits);
}
