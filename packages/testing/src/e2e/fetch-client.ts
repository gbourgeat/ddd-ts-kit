import type { HttpClient } from './http-client.js';
import type { HttpHeaders } from './http-headers.js';
import type { HttpResponse } from './http-response.js';
import { lowerCased } from './lower-cased.js';
import type { RequestOptions } from './request-options.js';

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
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...this.headers,
        ...lowerCased(options?.headers),
      },
      body: body === undefined ? null : JSON.stringify(body),
    });

    return {
      status: response.status,
      headers: Object.fromEntries(response.headers),
      // eslint-disable-next-line ddd-ts-kit/clean-no-escape-hatch -- the body type is the caller's claim about the API under test; nothing here can check it
      body: (await readBody(response)) as Body,
    };
  }
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
