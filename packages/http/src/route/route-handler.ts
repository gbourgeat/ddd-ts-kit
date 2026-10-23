import type { HandlerInput } from './handler-input';
import type { HandlerResult } from './handler-result';
import type { RequestSchemas } from './request-schemas';
import type { ResponsesSpec } from './responses-spec';

export type RouteHandler<
  Request extends RequestSchemas = RequestSchemas,
  Responses extends ResponsesSpec = ResponsesSpec,
> = (input: HandlerInput<Request>) => HandlerResult<Responses> | Promise<HandlerResult<Responses>>;
