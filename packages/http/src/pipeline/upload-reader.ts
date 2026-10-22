import type { UploadSpec } from '../route/upload-spec';
import type { RawRequest } from './raw-request';
import type { ReceivedUpload } from './received-upload';

/**
 * Reads the upload a route declares out of its request, as soon as the file starts to arrive.
 * `multipartUploads()` of `@ddd-ts-kit/http/uploads` is the one of the kit.
 */
export type UploadReader = (spec: UploadSpec, request: RawRequest) => Promise<ReceivedUpload>;
