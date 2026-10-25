import { DeclarationError } from '@ddd-ts-kit/kernel/declarations';
import type { Route } from '../../route/route';
import type { NestControllerClass } from './nest-controller-class';
import { nestControllerRoutes } from './nest-controller-routes';
import type { NestControllerRoutesOptions } from './nest-controller-routes-options';

/** The one route of a Nest controller with a single method carrying `@KitRoute`: what its spec calls. */
export function nestControllerRoute(controller: NestControllerClass, options: NestControllerRoutesOptions = {}): Route {
  const routes = nestControllerRoutes([controller], options);
  const [route] = routes;

  if (route === undefined || routes.length > 1) {
    throw new DeclarationError(
      `${controller.name} serves ${String(routes.length)} routes: nestControllerRoute takes a controller with one, nestControllerRoutes any number.`,
    );
  }

  return route;
}
