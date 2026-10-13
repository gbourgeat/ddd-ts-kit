import type { FollowedResponse } from './followed-response.js';
import type { SignedRequest } from './signed-request.js';

/** Follows a link over the network: for a storage that answers its own links, an object store. */
export async function followWithFetch(request: SignedRequest): Promise<FollowedResponse> {
  const response = await fetch(request.url, {
    method: request.method,
    headers: { ...request.headers },
    ...(request.body === undefined ? {} : { body: request.body }),
  });

  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: new Uint8Array(await response.arrayBuffer()),
  };
}
