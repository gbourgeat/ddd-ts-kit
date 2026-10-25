import type { KitRouteSpec } from './kit-route-spec';
import type { NestControllerClass } from './nest-controller-class';
import type { NestRouteMetadata } from './nest-route-metadata';
import type { Injected } from './nest-routes-registry';

/** One method of a Nest controller the kit serves: what Nest's decorators say, and what the kit's say. */
export interface NestMethod {
  readonly controller: NestControllerClass;
  readonly name: string;
  /** `InvoicesController.issue`, for the messages. */
  readonly where: string;
  /** What @KitRoute says, its name and its summary given when it said none. */
  readonly spec: KitRouteSpec & Required<Pick<KitRouteSpec, 'operationId' | 'summary'>>;
  readonly read: NestRouteMetadata;
  /** By index, what a parameter decorator of the kit asks for. */
  readonly injected: ReadonlyMap<number, Injected>;
}
