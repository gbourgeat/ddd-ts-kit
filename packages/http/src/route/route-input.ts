import type { IncomingFile } from './incoming-file';
import type { RequestContext } from './request-context';

/** The handler input once the schema types are erased, as the pipeline sees it. */
export interface RouteInput {
  readonly params: unknown;
  readonly query: unknown;
  readonly headers: unknown;
  readonly body: unknown;
  /** The file of a route that declares an upload. */
  readonly upload?: IncomingFile;
  readonly context: RequestContext;
}
