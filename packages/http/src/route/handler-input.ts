import type { Schema } from '@ddd-ts-kit/validation';
import type { RawHeaders } from './raw-headers.js';
import type { RequestContext } from './request-context.js';
import type { RequestSchemas } from './request-schemas.js';

interface PartDefaults {
  params: Record<string, string>;
  query: Record<string, unknown>;
  headers: RawHeaders;
  body: unknown;
}

type PartOf<Request, Part extends keyof PartDefaults> = Request extends {
  readonly [K in Part]: Schema<infer T>;
}
  ? T
  : PartDefaults[Part];

/** What a handler receives: each part has the type its schema produces. */
export interface HandlerInput<Request extends RequestSchemas = RequestSchemas> {
  readonly params: PartOf<Request, 'params'>;
  readonly query: PartOf<Request, 'query'>;
  readonly headers: PartOf<Request, 'headers'>;
  readonly body: PartOf<Request, 'body'>;
  readonly context: RequestContext;
}
