import type { Actor } from '@ddd-ts-kit/kernel';
import type { ControllerClass } from '../controller/controller-class';
import { controllerRoute } from '../controller/controller-route';
import type { ControllerRoutesOptions } from '../controller/controller-routes-options';
import type { ErasedController } from '../controller/erased-controller';
import { executeRoute } from '../pipeline/execute-route';
import type { RawRequest } from '../pipeline/raw-request';
import type { Route } from '../route/route';
import type { RouteOfOptions } from './route-of-options';
import type { RouteUnderTest } from './route-under-test';
import type { SentRequest } from './sent-request';

const AUTHENTICATED_USER: Actor = { id: 'user-1', type: 'user', roles: [], attributes: {} };

/**
 * The route of a spec, ready to be sent requests: a controller, as an instance or as a class
 * built by `resolve`, or a route already built (`defineRoute`, `nestControllerRoute`). Every
 * request goes through the whole pipeline as `caller`, guards included, and its answer is
 * checked against the declaration of the route:
 *
 *     const commands = new RecordingCommandBus().answering(IssueInvoiceCommand, () => 'invoice-1');
 *     const { send, caller } = routeOf(new IssueInvoiceController(commands));
 *
 *     const response = await send({ body: { customerId: 'customer-1' } });
 *
 *     expect(response).toMatchObject({ status: 201, body: { id: 'invoice-1' } });
 *     expect(commands.executed).toEqual([new IssueInvoiceCommand(caller, 'customer-1')]);
 */
export function routeOf(
  target: Route | ControllerClass | ErasedController,
  options: RouteOfOptions = {},
): RouteUnderTest {
  const { caller = AUTHENTICATED_USER, resolve, security, guards, ...execution } = options;

  const building: ControllerRoutesOptions = {
    ...(resolve === undefined ? {} : { resolve }),
    ...(security === undefined ? {} : { security }),
    ...(guards === undefined ? {} : { guards }),
  };

  const route = isRoute(target) ? built(target, building) : controllerRoute(target, building);

  return {
    route,
    caller,
    send: (request = {}) =>
      executeRoute(route, rawRequestOf(request), {
        validateResponses: true,
        ...execution,
        resolvePrincipal: () => caller,
      }),
  };
}

/** A route already built carries its guards and its security: what builds those of a controller cannot change it. */
function built(route: Route, building: ControllerRoutesOptions): Route {
  if (Object.keys(building).length > 0) {
    throw new TypeError(
      `${route.operationId} is a route already built: \`resolve\`, \`security\` and \`guards\` build the route of a controller. Give the controller instead, or leave them out.`,
    );
  }

  return route;
}

function isRoute(target: Route | ControllerClass | ErasedController): target is Route {
  return typeof target === 'object' && 'responses' in target && 'operationId' in target;
}

function rawRequestOf({ params = {}, query = {}, headers = {}, body, raw, stream }: SentRequest): RawRequest {
  return { params, query, headers, body, raw, ...(stream === undefined ? {} : { stream }) };
}
