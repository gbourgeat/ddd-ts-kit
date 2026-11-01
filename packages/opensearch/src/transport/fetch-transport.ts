import { OpenSearchUnavailableError } from '../errors/open-search-unavailable-error';
import type { FetchTransportOptions } from './fetch-transport-options';
import type { OpenSearchRequest, OpenSearchResponse, OpenSearchTransport } from './open-search-transport';

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * The transport on the `fetch` of Node, with no client library: JSON in and out, the credentials
 * on every request, and a timeout. A request with no answer rejects with `OpenSearchUnavailableError`.
 */
export function fetchTransport(options: FetchTransportOptions): OpenSearchTransport {
  const node = withoutTrailingSlashes(options.node);
  const headers = headersOf(options.auth);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    async request({ method, path, query, body }: OpenSearchRequest): Promise<OpenSearchResponse> {
      const search = query === undefined ? '' : `?${new URLSearchParams(query).toString()}`;

      try {
        const response = await fetch(`${node}${path}${search}`, {
          method,
          headers: body === undefined ? headers : { ...headers, 'content-type': 'application/json' },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: AbortSignal.timeout(timeoutMs),
        });

        return { status: response.status, body: parsed(await response.text()) };
      } catch (cause) {
        throw new OpenSearchUnavailableError(method, path, { cause });
      }
    },
  };
}

function headersOf(auth: FetchTransportOptions['auth']): Record<string, string> {
  const accept = { accept: 'application/json' };

  if (auth === undefined) {
    return accept;
  }

  if ('authorization' in auth) {
    return { ...accept, authorization: auth.authorization };
  }

  return { ...accept, authorization: `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString('base64')}` };
}

/** A proxy in front of the cluster may answer a page of its own: such a body is no answer of the node. */
function parsed(text: string): unknown {
  try {
    return text === '' ? undefined : JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** The node URL without the slashes it ends with, read from the end in one pass. */
function withoutTrailingSlashes(node: string): string {
  let end = node.length;

  while (end > 0 && node[end - 1] === '/') {
    end -= 1;
  }

  return node.slice(0, end);
}
