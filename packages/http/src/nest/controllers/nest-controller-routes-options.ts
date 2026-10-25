import type { Schema } from '@ddd-ts-kit/validation';
import type { ControllerRoutesOptions } from '../../controller/controller-routes-options';
import type { DtoType } from './dto-type';
import type { NestControllerClass } from './nest-controller-class';

export interface NestControllerRoutesOptions extends Pick<ControllerRoutesOptions, 'resolve' | 'security'> {
  /**
   * The instance that answers the routes of a controller, built by Nest's container: asked at the
   * first call, so that the contract is generated without one.
   */
  readonly instanceOf?: (controller: NestControllerClass) => unknown;
  /** The schema of a DTO class, a parameter typed by one or a response body: `classSchema` of `@ddd-ts-kit/validation/class-validator`. */
  readonly schemaOfClass?: (dto: DtoType) => Schema<unknown>;
}
