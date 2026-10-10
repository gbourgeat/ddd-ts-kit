import type { RequestSchemas } from './request-schemas.js';
import type { ResponsesSpec } from './responses-spec.js';
import type { RouteHandler } from './route-handler.js';
import type { RouteSpec } from './route-spec.js';
import type { Route } from './route.js';

const PATH_PATTERN = /^\/$|^(\/(:[A-Za-z_][A-Za-z0-9_]*|[A-Za-z0-9._~-]+))+$/;

export function defineRoute<const Request extends RequestSchemas, const Responses extends ResponsesSpec>(
  spec: RouteSpec<Request, Responses>,
  handler: RouteHandler<Request, Responses>,
): Route {
  if (!PATH_PATTERN.test(spec.path)) {
    throw new Error(
      `Route "${spec.operationId}": the path "${spec.path}" must be made of literal segments and ":name" parameters.`,
    );
  }

  assertSecurityDeclared(spec);

  return { ...spec, handle: handler };
}

// Checked at run time too: a JavaScript caller, or a spec built dynamically, gets no compile error.
function assertSecurityDeclared(spec: Pick<RouteSpec, 'operationId'> & { readonly security?: unknown }): void {
  const { security } = spec;

  if (security === false || (Array.isArray(security) && security.length > 0)) {
    return;
  }

  throw new Error(
    `Route "${spec.operationId}": declare "security" with the names of its security schemes, or false for a public route.`,
  );
}
