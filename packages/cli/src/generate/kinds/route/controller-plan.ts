import type { RouteGroup } from './route-group.js';
import type { RouteParts } from './route-vars.js';

/** A controller about to be written: its route, its group, where it goes and what stands next to it. */
export interface ControllerPlan extends RouteParts {
  readonly group: RouteGroup | undefined;
  /** Its folder inside the context: `presentation/http/appointments/book-appointment`. */
  readonly folder: string;
  readonly withMapper: boolean;
  /** Only the controller of a plain query answers through a serializer. */
  readonly withSerializer: boolean;
}
