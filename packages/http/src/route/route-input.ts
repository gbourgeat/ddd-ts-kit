import type { RequestContext } from './request-context.js';

/** The handler input once the schema types are erased, as the pipeline sees it. */
export interface RouteInput {
  readonly params: unknown;
  readonly query: unknown;
  readonly headers: unknown;
  readonly body: unknown;
  readonly context: RequestContext;
}
