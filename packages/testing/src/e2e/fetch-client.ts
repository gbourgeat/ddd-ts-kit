import type { HttpClient } from './http-client';
import type { HttpHeaders } from './http-headers';
import type { HttpResponse } from './http-response';
import { lowerCased } from './lower-cased';
import type { RequestOptions } from './request-options';

interface Exchange {
  readonly method: string;
  readonly path: string;
  readonly body?: unknown;
  readonly options: RequestOptions | undefined;
}

/** The JSON client over the global `fetch`. It expects a base URL without trailing slash and headers in lower case. */
export class FetchClient implements HttpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly headers: HttpHeaders,
  ) {}

  get<Body>(path: string, options?: RequestOptions): Promise<HttpResponse<Body>> {
    return this.send({ method: 'GET', path, options });
  }

  post<Body>(path: string, body?: unknown, options?: RequestOptions): Promise<HttpResponse<Body>> {
    return this.send({ method: 'POST', path, body, options });
  }

  put<Body>(path: string, body?: unknown, options?: RequestOptions): Promise<HttpResponse<Body>> {
    return this.send({ method: 'PUT', path, body, options });
  }

  patch<Body>(path: string, body?: unknown, options?: RequestOptions): Promise<HttpResponse<Body>> {
    return this.send({ method: 'PATCH', path, body, options });
  }

  delete<Body>(path: string, options?: RequestOptions): Promise<HttpResponse<Body>> {
    return this.send({ method: 'DELETE', path, options });
  }

  withHeaders(headers: HttpHeaders): HttpClient {
    return new FetchClient(this.baseUrl, { ...this.headers, ...lowerCased(headers) });
  }

  private async send<Body>({ method, path, body, options }: Exchange): Promise<HttpResponse<Body>> {
    const headers = {
      ...(body === undefined || isRaw(body) ? {} : { 'content-type': 'application/json' }),
      ...this.headers,
      ...lowerCased(options?.headers),
    };

    const response = await fetch(`${this.baseUrl}${path}`, { method, headers, body: payloadOf(body, headers) });

    return {
      status: response.status,
      headers: Object.fromEntries(response.headers),
      // eslint-disable-next-line ddd-ts-kit/clean-no-escape-hatch -- the body type is the caller's claim about the API under test; nothing here can check it
      body: (await readBody(response)) as Body,
    };
  }
}

/**
 * JSON, unless the request says another content type and gives its text as it is (an XML body, a CSV import),
 * or gives bytes, a blob or a form, sent as they are: a file to upload, in any encoding.
 */
function payloadOf(
  body: unknown,
  headers: Readonly<Record<string, string>>,
): string | Uint8Array<ArrayBuffer> | Blob | FormData | null {
  if (body === undefined) {
    return null;
  }

  if (isRaw(body)) {
    return body;
  }

  return typeof body === 'string' && !isJson(headers['content-type'] ?? null) ? body : JSON.stringify(body);
}

/** What `fetch` sends without reading it as text: its content type is the caller's, or the one of the form. */
function isRaw(body: unknown): body is Uint8Array<ArrayBuffer> | Blob | FormData {
  return body instanceof Uint8Array || body instanceof Blob || body instanceof FormData;
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();

  if (text === '') {
    return undefined;
  }

  return isJson(response.headers.get('content-type')) ? JSON.parse(text) : text;
}

function isJson(contentType: string | null): boolean {
  return /[/+]json\b/i.test(contentType ?? '');
}
