import type { EndedSpan } from './ended-span.js';

const REDACTED = 'REDACTED';
const URL_ATTRIBUTES = ['url.full', 'http.url'];
const QUERY_ATTRIBUTE = 'url.query';
const USERINFO = /^([A-Za-z][A-Za-z0-9+.-]*:\/\/)[^/?#@]*@/;

/**
 * Redacts credentials from URLs recorded by HTTP instrumentations: query string values
 * (names are kept) and userinfo, in `url.full`, `http.url` and `url.query`.
 */
export class UrlSecretSpanProcessor {
  onStart(): void {}

  onEnd(span: EndedSpan): void {
    for (const key of URL_ATTRIBUTES) {
      const value = span.attributes[key];

      if (typeof value === 'string') {
        span.attributes[key] = redactUrl(value);
      }
    }

    const query = span.attributes[QUERY_ATTRIBUTE];

    if (typeof query === 'string') {
      const body = query.startsWith('?') ? query.slice(1) : query;

      span.attributes[QUERY_ATTRIBUTE] = `${query.startsWith('?') ? '?' : ''}${redactQuery(body)}`;
    }
  }

  async forceFlush(): Promise<void> {}

  async shutdown(): Promise<void> {}
}

// Plain string surgery instead of `new URL`: the attribute may hold a relative or
// malformed URL, and it must be redacted all the same.
function redactUrl(url: string): string {
  const hashAt = url.indexOf('#');
  const fragment = hashAt === -1 ? '' : url.slice(hashAt);
  const withoutFragment = hashAt === -1 ? url : url.slice(0, hashAt);
  const queryAt = withoutFragment.indexOf('?');
  const base = queryAt === -1 ? withoutFragment : withoutFragment.slice(0, queryAt);
  const query = queryAt === -1 ? '' : `?${redactQuery(withoutFragment.slice(queryAt + 1))}`;

  return `${base.replace(USERINFO, `$1${REDACTED}:${REDACTED}@`)}${query}${fragment}`;
}

function redactQuery(query: string): string {
  return query
    .split('&')
    .map((pair) => {
      const equals = pair.indexOf('=');

      return equals === -1 ? pair : `${pair.slice(0, equals)}=${REDACTED}`;
    })
    .join('&');
}
