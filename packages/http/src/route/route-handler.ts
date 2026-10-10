import type { HandlerInput } from './handler-input.js';
import type { HandlerResult } from './handler-result.js';
import type { RequestSchemas } from './request-schemas.js';
import type { ResponsesSpec } from './responses-spec.js';

export type RouteHandler<
  Request extends RequestSchemas = RequestSchemas,
  Responses extends ResponsesSpec = ResponsesSpec,
> = (input: HandlerInput<Request>) => HandlerResult<Responses> | Promise<HandlerResult<Responses>>;
