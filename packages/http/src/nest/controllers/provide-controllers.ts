import type { DynamicModule, ModuleMetadata } from '@nestjs/common';
import { ModuleRef, ModulesContainer } from '@nestjs/core';
import { assertNotRoutedByNest } from './assert-not-routed-by-nest';
import { ControllersBinder } from './controllers-binder';
import type { NestControllers } from './nest-controllers';

/**
 * The Nest module that builds the controllers `nestControllers` read, with what they inject, and
 * hands their routes the instances at the start. It mounts nothing: the routes are mounted with the
 * other routes of the application. A controller also among the `controllers` of a Nest module
 * stops the start.
 */
export function provideControllers(
  served: NestControllers,
  options: { readonly imports?: ModuleMetadata['imports'] } = {},
): DynamicModule {
  // One class per call: Nest identifies a module by its class.
  class ControllersModule {}

  return {
    module: ControllersModule,
    imports: options.imports ?? [],
    providers: [
      ...served.controllers,
      ...served.providers,
      {
        provide: ControllersBinder,
        inject: [ModuleRef, ModulesContainer],
        useFactory: (references: ModuleRef, modules: ModulesContainer): ControllersBinder => ({
          onModuleInit() {
            assertNotRoutedByNest(modules);
            served.bind(references);
          },
        }),
      },
    ],
  };
}
