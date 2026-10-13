import type { DurationText } from '@ddd-ts-kit/kernel';
import type { CacheScope } from './cache-scope.js';
import type { EntityTagSource } from './entity-tag-source.js';

/**
 * How the answer of a read may be kept by the caches on the way, declared on a controller or a
 * route group (`cache`), or on a function route. Durations are whole seconds written as text:
 * `'30s'`, `'5m'`, `'1h'`, `'0s'`.
 */
export interface CachePolicy {
  readonly scope: CacheScope;
  /** How long the answer stays fresh: `max-age`. Required unless the scope is `no-store`. */
  readonly maxAge?: DurationText;
  /** How long it stays fresh in a shared cache, which reads it instead of `maxAge`: `s-maxage`. Public only. */
  readonly sMaxAge?: DurationText;
  /** How long a stale answer may still be served while the cache asks the server again: `stale-while-revalidate`. */
  readonly staleWhileRevalidate?: DurationText;
  /** How long a stale answer may be served when the server fails: `stale-if-error`. */
  readonly staleIfError?: DurationText;
  /** Once stale, never served without asking the server: `must-revalidate`. */
  readonly mustRevalidate?: boolean;
  /**
   * The request headers the answer depends on, besides the URL: `Vary`. A public answer of a
   * route that is not public names here what it varies on (`Authorization`, a tenant header):
   * without it, a shared cache would hand the answer of one caller to the next.
   */
  readonly vary?: readonly string[];
  /** Answers `ETag`, and `304 Not Modified` to a request whose `If-None-Match` names it. */
  readonly etag?: EntityTagSource;
  /** The field of the body holding the instant the resource last changed: `Last-Modified`, and `304` to `If-Modified-Since`. */
  readonly lastModified?: string;
}
