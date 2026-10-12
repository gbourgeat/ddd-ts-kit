import { Readable } from 'node:stream';
import { contentDisposition, type ServedFileStorage } from '@ddd-ts-kit/kernel';
import type { FollowedResponse } from './followed-response.js';
import { readAll } from './read-all.js';
import type { SignedRequest } from './signed-request.js';

/**
 * Follows a link of a storage the application serves, without a server: the token is the `token`
 * parameter of the query, answered the way `signedFileRoutes` of `@ddd-ts-kit/http` answers it.
 */
export function followServed(storage: ServedFileStorage): (request: SignedRequest) => Promise<FollowedResponse> {
  return async (request) => {
    const token = new URL(request.url).searchParams.get('token') ?? '';

    if (request.method === 'GET') {
      const download = await storage.openSigned(token);

      return download === undefined
        ? refused()
        : { status: 200, headers: dispositionOf(download.fileName), body: await readAll(download.stream) };
    }

    const body = Readable.from([Buffer.from(request.body ?? new Uint8Array())]);
    const stored = await storage.acceptSigned(token, body, request.headers?.['content-type'] ?? '');

    return stored === undefined ? refused() : { status: 200, headers: {}, body: new Uint8Array() };
  };
}

function refused(): FollowedResponse {
  return { status: 403, headers: {}, body: new Uint8Array() };
}

function dispositionOf(fileName: string | undefined): Record<string, string> {
  return fileName === undefined ? {} : { 'content-disposition': contentDisposition(fileName) };
}
