import type { Readable } from 'node:stream';
import type { ExecutionContext } from '@ddd-ts-kit/kernel';
import type { RawHeaders } from './raw-headers';

export interface RequestContext {
  readonly requestId: string;
  /**
   * What this request carries for everything it causes: correlation id, actor, session, locale,
   * deadline, origin `http`. The same object the execution scope runs the handler in.
   */
  readonly execution: ExecutionContext;
  readonly principal?: unknown;
  /** The headers as they arrived, before any schema: where a guard reads a credential the application does not resolve. */
  readonly rawHeaders?: RawHeaders;
  /** The framework's own request object, for the rare case the neutral input is not enough. */
  readonly raw: unknown;
  /** The version named in `If-Match`, on a route that declares `ifMatch`: absent when the caller named none, or `*`. */
  readonly expectedVersion?: number;
  /** The body as it arrives, unparsed, for a route declared with `rawBody`. */
  readonly stream?: Readable;
}
