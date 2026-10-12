import { contentDisposition, type ServedFileStorage, type SignedDownload } from '@ddd-ts-kit/kernel';
import { ForbiddenError } from '../error/forbidden-error.js';
import { headerOf } from '../route/header-of.js';
import type { RouteInput } from '../route/route-input.js';
import type { RouteOutput } from '../route/route-output.js';
import type { Route } from '../route/route.js';
import { withoutTrailingSlashes } from '../route/without-trailing-slashes.js';
import type { SignedFileRoutesOptions } from './signed-file-routes-options.js';

/**
 * The two routes that answer the signed links of a storage the application serves, the local
 * directory of development or the memory of the tests: `GET <prefix>?token=` downloads, `PUT
 * <prefix>?token=` uploads. Public, since the token is the grant; a forged, expired or misused
 * token is answered 403. Not part of the contract: mount them next to the routes of the
 * contexts, and only where such a storage is bound. An object store answers its own links.
 * With Express, mount them before `express.json()`: that parser reads a JSON body first, and a
 * JSON file sent through a link would then be refused.
 */
export function signedFileRoutes(storage: ServedFileStorage, options: SignedFileRoutesOptions = {}): readonly Route[] {
  const path = withoutTrailingSlashes(options.prefix ?? '/files');
  const common = { path, security: false as const, errors: ['FORBIDDEN'] };

  return [
    {
      ...common,
      method: 'GET',
      operationId: 'downloadSignedFile',
      summary: 'Download the file a signed link grants',
      responses: { 200: { description: 'The file.' } },
      handle: async (input) => downloaded(await storage.openSigned(tokenOf(input))),
    },
    {
      ...common,
      method: 'PUT',
      operationId: 'uploadSignedFile',
      summary: 'Upload the file a signed link grants',
      rawBody: true,
      responses: { 200: { description: 'Stored.' } },
      handle: async (input) => uploaded(storage, input),
    },
  ];
}

function tokenOf(input: RouteInput): string {
  const query: Partial<Record<string, unknown>> =
    typeof input.query === 'object' && input.query !== null ? input.query : {};

  return typeof query['token'] === 'string' ? query['token'] : '';
}

function downloaded(download: SignedDownload | undefined): RouteOutput {
  if (download === undefined) {
    throw new ForbiddenError('This link does not grant a download.');
  }

  const { metadata, stream, fileName } = download;

  return {
    status: 200,
    body: stream,
    headers: {
      'content-type': metadata.mediaType,
      'content-length': String(metadata.size),
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
      'content-disposition': fileName === undefined ? 'attachment' : contentDisposition(fileName),
    },
  };
}

async function uploaded(storage: ServedFileStorage, input: RouteInput): Promise<RouteOutput> {
  const { stream, rawHeaders } = input.context;

  if (stream === undefined || stream.readableEnded) {
    throw new ForbiddenError(
      'The body of this upload was read before it reached the route: mount it before a body parser.',
    );
  }

  const stored = await storage.acceptSigned(tokenOf(input), stream, headerOf(rawHeaders ?? {}, 'content-type'));

  if (stored === undefined) {
    throw new ForbiddenError('This link does not grant this upload.');
  }

  return { status: 200 };
}
