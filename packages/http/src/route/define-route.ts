import { assertCacheDeclaration } from '../cache/assert-cache-declaration';
import type { RequestSchemas } from './request-schemas';
import type { ResponsesSpec } from './responses-spec';
import { ROUTE_PATH_PATTERN } from './route-path-pattern';
import type { RouteHandler } from './route-handler';
import type { RouteSpec } from './route-spec';
import type { Route } from './route';
import { uploadDefects } from './upload-defects';

export function defineRoute<const Request extends RequestSchemas, const Responses extends ResponsesSpec>(
  spec: RouteSpec<Request, Responses>,
  handler: RouteHandler<Request, Responses>,
): Route {
  if (!ROUTE_PATH_PATTERN.test(spec.path)) {
    throw new Error(
      `Route "${spec.operationId}": the path "${spec.path}" must be made of literal segments and ":name" parameters.`,
    );
  }

  assertSecurityDeclared(spec);
  assertCacheDeclaration(spec);
  assertUploadReceivable(spec);

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

/** An upload whose media types no content could prove receives no file: said when the route is defined, not by a 415 to each client. */
function assertUploadReceivable({ operationId, upload }: Pick<RouteSpec, 'operationId' | 'upload'>): void {
  const defects = uploadDefects(upload);

  if (defects.length > 0) {
    throw new Error(`Route "${operationId}" declares an upload it cannot receive: ${defects.join(' ')}`);
  }
}
