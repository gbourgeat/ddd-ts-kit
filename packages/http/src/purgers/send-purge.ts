import { CachePurgeError } from './cache-purge-error.js';
import type { PurgeRequest } from './purge-request.js';

const SUCCESS_FROM = 200;
const SUCCESS_TO = 299;

/** Sends a purge and resolves once the cache confirmed it with a 2xx; anything else is a `CachePurgeError`. */
export async function sendPurge(request: PurgeRequest, timeoutMs: number): Promise<void> {
  const answer = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    ...(request.body === undefined ? {} : { body: request.body }),
    signal: AbortSignal.timeout(timeoutMs),
  }).catch((cause: unknown) => {
    throw new CachePurgeError(`${request.method} ${request.url} reached no cache.`, undefined, { cause });
  });

  await answer.body?.cancel();

  if (answer.status < SUCCESS_FROM || answer.status > SUCCESS_TO) {
    throw new CachePurgeError(`${request.method} ${request.url} answered ${answer.status}.`, answer.status);
  }
}
