import type { Attributes, SpanStatus } from '@opentelemetry/api';

/**
 * The part of an ended SDK span these processors touch. Declared here so the root entry
 * depends on `@opentelemetry/api` only; the SDK `ReadableSpan` is assignable to it.
 */
export interface EndedSpan {
  attributes: Attributes;
  events: { attributes?: Attributes }[];
  status: SpanStatus;
}

const REDACTED = 'REDACTED';
const URL_ATTRIBUTES = ['url.full', 'http.url'];
const QUERY_ATTRIBUTE = 'url.query';
const USERINFO = /^([A-Za-z][A-Za-z0-9+.-]*:\/\/)[^/?#@]*@/;

/*
 * Both processors below edit the span in `onEnd`. The SDK types a span as read-only at
 * that point and offers no supported way to rewrite an attribute or an event of a span
 * created by someone else (auto-instrumentation). With sdk-trace-base 2.x the attributes,
 * events and status are plain mutable objects, and exporters read them after every
 * processor ran, so mutating them here is the usual approach. Register these processors
 * BEFORE the exporting one.
 */

/**
 * Redacts credentials from URLs recorded by HTTP instrumentations: query string values
 * (names are kept) and userinfo, in `url.full`, `http.url` and `url.query`.
 */
export class UrlSecretSpanProcessor {
  onStart(): void {}

  onEnd(span: EndedSpan): void {
    for (const key of URL_ATTRIBUTES) {
      const value = span.attributes[key];
      if (typeof value === 'string') span.attributes[key] = redactUrl(value);
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

/**
 * Removes what `recordException` and instrumentations copy from an error: the
 * `exception.message` and `exception.stacktrace` event attributes and the status
 * message. `exception.type` stays.
 */
export class ErrorMessageScrubber {
  onStart(): void {}

  onEnd(span: EndedSpan): void {
    for (const event of span.events) {
      if (event.attributes === undefined) continue;
      delete event.attributes['exception.message'];
      delete event.attributes['exception.stacktrace'];
    }
    delete span.status.message;
  }

  async forceFlush(): Promise<void> {}

  async shutdown(): Promise<void> {}
}
