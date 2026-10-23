import type { Route } from '../route/route';
import type { ControllerClass } from './controller-class';
import type { ErasedController } from './erased-controller';
import type { ControllerRoutesOptions } from './controller-routes-options';
import { controllerRoutes } from './controller-routes';

/** The route of one controller: what a spec hands to `executeRoute`. */
export function controllerRoute(
  controller: ControllerClass | ErasedController,
  options: ControllerRoutesOptions = {},
): Route {
  const [route] = controllerRoutes([controller], options);

  if (route === undefined) {
    throw new Error('A controller declares one route, and none was built.');
  }

  return route;
}
