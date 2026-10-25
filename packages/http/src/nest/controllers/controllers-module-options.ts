import type { Provider } from '@nestjs/common';
import type { RoutesModuleOptions } from '../create-routes-module';
import type { NestControllerRoutesOptions } from './nest-controller-routes-options';

export interface ControllersModuleOptions
  extends RoutesModuleOptions,
    Pick<NestControllerRoutesOptions, 'schemaOfClass' | 'security'> {
  /** What the controllers and the guards they name are built with, besides what `imports` exports. */
  readonly providers?: readonly Provider[];
}
