import type { IncomingFile } from '../route/incoming-file';
import type { Route } from '../route/route';
import type { ExecuteOptions } from './execute-options';
import type { RawRequest } from './raw-request';

interface Received {
  readonly request: RawRequest;
  readonly upload?: IncomingFile;
}

/** For a route that declares an upload: its text fields become the body, its file the `upload` of the input. */
export async function receiveUpload(route: Route, request: RawRequest, options: ExecuteOptions): Promise<Received> {
  if (route.upload === undefined) {
    return { request };
  }

  if (options.uploads === undefined) {
    throw new Error(
      `Route "${route.operationId}" declares an upload: mount the routes with \`uploads: multipartUploads()\` of @ddd-ts-kit/http/uploads.`,
    );
  }

  const { fields, file } = await options.uploads(route.upload, request);

  return { request: { ...request, body: fields }, upload: file };
}
