import type { Provider } from '@nestjs/common';
import type { NestControllerRoutesOptions } from './nest-controller-routes-options';

export interface NestControllersOptions extends Pick<NestControllerRoutesOptions, 'schemaOfClass' | 'security'> {
  /** What the controllers inject, as Nest providers: the buses of the application, `{ provide: CommandBus, useValue: commands }`. */
  readonly providers?: readonly Provider[];
}
