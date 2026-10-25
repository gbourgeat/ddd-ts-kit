import type { KitRoutesOptions } from './kit-routes-options';
import type { NestControllerClass } from './nest-controller-class';
import { nestRoutesRegistry } from './nest-routes-registry';

/** What every route of a Nest controller shares: its guards first, its tags and its error codes. */
export function KitRoutes(options: KitRoutesOptions): (target: NestControllerClass) => void {
  return (target) => {
    nestRoutesRegistry().controllers.set(target, options);
  };
}
