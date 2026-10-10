import { ResponseContractError } from '../error/response-contract-error.js';
import type { RouteOutput } from '../route/route-output.js';
import type { Route } from '../route/route.js';

export function assertDeclaredResponse(route: Route, { status, body }: RouteOutput): void {
  const declared = route.responses[status];

  if (declared === undefined) {
    throw new ResponseContractError(
      `Route "${route.operationId}" answered ${status}, which it does not declare.`,
    );
  }

  if (declared.body === undefined) {
    if (body !== undefined) {
      throw new ResponseContractError(
        `Route "${route.operationId}" answered ${status} with a body, but declares none.`,
      );
    }

    return;
  }

  const result = declared.body.parse(body);

  if (!result.ok) {
    throw new ResponseContractError(
      `Route "${route.operationId}" answered ${status} with a body that does not match its schema.`,
      result.error,
    );
  }
}
